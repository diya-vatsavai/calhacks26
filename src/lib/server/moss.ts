import "server-only";
// Moss semantic memory service. Moss indexes are built in the Moss cloud and loaded into this
// long-running Node server for sub-millisecond on-device queries, so retrieval lives here
// (not in short-lived Convex actions). Convex stays the source of truth and stores doc ids.
import { MossClient, type DocumentInfo, type MetadataFilter } from "@inferedge/moss";
// `waitForJob` throws on timeout so callers never mark documents indexed that Moss doesn't have.
import { fallbackSimilarity } from "../../../convex/lib/concepts";

export type Hit = { id: string; text: string; score: number; metadata: Record<string, string> };
export type RetrievalMode = "moss" | "fallback";

const PROJECT_ID = process.env.MOSS_PROJECT_ID;
const PROJECT_KEY = process.env.MOSS_PROJECT_KEY;
const MODEL = process.env.MOSS_MODEL_ID || "moss-minilm";

export const mossConfigured = () => Boolean(PROJECT_ID && PROJECT_KEY);

type State = {
  client: MossClient | null;
  loaded: Set<string>;
  known: Map<string, boolean>; // index name → exists
  lock: Promise<unknown>;
};
const g = globalThis as unknown as { __kindredMoss?: State };
const state: State = (g.__kindredMoss ??= {
  client: mossConfigured() ? new MossClient(PROJECT_ID!, PROJECT_KEY!) : null,
  loaded: new Set(),
  known: new Map(),
  lock: Promise.resolve(),
});

/**
 * Serializes index builds and loads. The first loadIndex downloads the embedding model into a
 * shared on-disk cache; concurrent downloads in one process would corrupt it.
 */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = state.lock.then(fn, fn);
  state.lock = run.catch(() => {});
  return run;
}

async function load(indexName: string) {
  await state.client!.loadIndex(indexName);
  state.loaded.add(indexName);
}

async function indexExists(name: string) {
  const client = state.client!;
  if (state.known.has(name)) return state.known.get(name)!;
  try {
    await client.getIndex(name);
    state.known.set(name, true);
  } catch {
    state.known.set(name, false);
  }
  return state.known.get(name)!;
}

async function waitForJob(jobId: string | undefined, timeoutMs = 90_000) {
  if (!jobId) return;
  const client = state.client!;
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const s = await client.getJobStatus(jobId);
      if (s.status === "completed") return;
      if (s.status === "failed") throw new Error(s.error || "Moss indexing job failed");
    } catch (e) {
      if ((e as Error).message.includes("failed")) throw e;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Moss job ${jobId} did not finish within ${timeoutMs / 1000}s`);
}

/** Fresh existence check against Moss (bypasses the cache) — used to heal Convex/Moss drift. */
export async function indexReady(name: string) {
  if (!state.client) return false;
  try {
    const info = await state.client.getIndex(name);
    state.known.set(name, true);
    return info.status === "Ready" || info.status === "Building";
  } catch {
    state.known.set(name, false);
    state.loaded.delete(name);
    return false;
  }
}

/** Upsert documents into an index (creating it on first use) and refresh the local copy. */
export async function upsertDocs(indexName: string, docs: DocumentInfo[]): Promise<{ mode: RetrievalMode; latencyMs: number }> {
  const t0 = Date.now();
  if (!docs.length) return { mode: state.client ? "moss" : "fallback", latencyMs: 0 };
  // Fallback mode stores nothing: queries rank the caller's Convex documents directly.
  if (!state.client) return { mode: "fallback", latencyMs: Date.now() - t0 };
  const client = state.client;
  await serial(async () => {
    if (await indexExists(indexName)) {
      const res = await client.addDocs(indexName, docs, { upsert: true });
      await waitForJob(res.jobId);
    } else {
      const res = await client.createIndex(indexName, docs, { modelId: MODEL });
      await waitForJob(res.jobId);
      state.known.set(indexName, true);
    }
    // Reload so queries see the new documents.
    await load(indexName);
  });
  return { mode: "moss", latencyMs: Date.now() - t0 };
}

export async function deleteDocs(indexName: string, ids: string[]) {
  if (!ids.length) return;
  if (!state.client) return;
  if (!(await indexExists(indexName))) return;
  const client = state.client;
  await serial(async () => {
    const res = await client.deleteDocs(indexName, ids);
    await waitForJob(res.jobId);
    await load(indexName);
  });
}

/**
 * Semantic query against a Moss index. When Moss is not configured, ranks `fallbackCorpus`
 * (the caller's own documents, fetched from Convex) with the concept lexicon — labeled "fallback".
 */
export async function search(
  indexName: string,
  text: string,
  opts: { topK?: number; filter?: MetadataFilter; where?: Record<string, string>; fallbackCorpus?: DocumentInfo[] } = {},
): Promise<{ hits: Hit[]; mode: RetrievalMode; latencyMs: number }> {
  const t0 = Date.now();
  const topK = opts.topK ?? 5;
  if (!state.client) {
    const docs = (opts.fallbackCorpus ?? []).filter((d) =>
      Object.entries(opts.where ?? {}).every(([k, val]) => d.metadata?.[k] === val),
    );
    const hits = docs
      .map((d) => ({ id: d.id, text: d.text, metadata: d.metadata ?? {}, score: fallbackSimilarity(text, d.text) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return { hits, mode: "fallback", latencyMs: Date.now() - t0 };
  }
  const client = state.client;
  if (!(await indexExists(indexName))) return { hits: [], mode: "moss", latencyMs: Date.now() - t0 };
  if (!state.loaded.has(indexName)) await serial(() => (state.loaded.has(indexName) ? Promise.resolve() : load(indexName)));
  const filter =
    opts.filter ??
    (opts.where && Object.keys(opts.where).length
      ? Object.entries(opts.where).length === 1
        ? { field: Object.keys(opts.where)[0], condition: { $eq: Object.values(opts.where)[0] } }
        : { $and: Object.entries(opts.where).map(([field, val]) => ({ field, condition: { $eq: val } })) }
      : undefined);
  const res = await client.query(indexName, text, { topK, ...(filter ? { filter } : {}) });
  return {
    hits: res.docs.map((d) => ({ id: d.id, text: d.text, score: d.score, metadata: d.metadata ?? {} })),
    mode: "moss",
    latencyMs: res.timeTakenInMs ?? Date.now() - t0,
  };
}

export async function listIndexes() {
  if (!state.client) return null;
  const list = await state.client.listIndexes();
  return list.map((i) => ({ name: i.name, status: i.status, docCount: i.docCount, model: i.model?.id ?? null }));
}

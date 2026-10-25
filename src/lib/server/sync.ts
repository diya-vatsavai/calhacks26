import "server-only";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { deleteDocs, indexReady, mossConfigured, search, upsertDocs } from "./moss";
import { report, serverSecret } from "./convex";

/**
 * Kindred keeps ONE Moss index for everything (profiles, memories, learning insights), tagged with
 * `kind` and, for personal documents, `ownerId`. One shared index keeps us inside Moss's per-project
 * index quota; privacy comes from server-side owner filters plus a Convex ownership re-check.
 */
export const KINDRED_INDEX = process.env.MOSS_INDEX_NAME || "kindred";

// Orphan ids with a Moss delete already in flight (avoids queueing the same delete repeatedly).
const cleaning = new Set<string>();

/** Index the caller's pending memories / learning insights (scoped by their ownerId). */
export async function syncViewer(client: ConvexHttpClient) {
  const live = mossConfigured();
  let pending = await client.query(api.mossSync.pendingForViewer, {});
  if (!pending.scope) return { mode: "none" as const, indexed: 0, removed: 0 };
  // Heal drift: if the index is gone from Moss, re-send every eligible document.
  if (live && !(await indexReady(KINDRED_INDEX))) {
    const all = await client.query(api.mossSync.pendingForViewer, { all: true });
    pending = { ...all, removals: [] };
  }
  const scope = pending.scope!;
  let indexed: typeof pending.upserts = [];
  let failed: typeof pending.upserts = [];
  if (live && pending.upserts.length) {
    try {
      const { latencyMs } = await upsertDocs(
        KINDRED_INDEX,
        pending.upserts.map((d) => ({ id: d.id, text: d.text, metadata: d.metadata })),
      );
      indexed = pending.upserts;
      report(client, { service: "moss", operation: "index.upsert", status: "success", mode: "live", latencyMs, detail: `${indexed.length} ${scope.kind === "memory" ? "memories" : "insights"}` });
    } catch (e) {
      failed = pending.upserts;
      report(client, { service: "moss", operation: "index.upsert", status: "error", mode: "live", detail: (e as Error).message });
    }
  } else if (!live && pending.upserts.length) {
    report(client, { service: "moss", operation: "index.upsert", status: "skipped", mode: "demo", detail: "MOSS_PROJECT_ID/KEY not set — documents stay in Convex only" });
  }
  if (live && pending.removals.length) {
    try {
      await deleteDocs(KINDRED_INDEX, pending.removals.map((r) => r.id));
      report(client, { service: "moss", operation: "index.delete", status: "success", mode: "live", detail: `${pending.removals.length} docs` });
    } catch (e) {
      report(client, { service: "moss", operation: "index.delete", status: "error", mode: "live", detail: (e as Error).message });
      return { mode: "moss" as const, indexed: indexed.length, removed: 0 };
    }
  }
  if (indexed.length || pending.removals.length || failed.length) {
    await client.mutation(api.mossSync.markSynced, {
      indexed: indexed.map(({ table, id }) => ({ table, id })),
      removed: pending.removals,
      failed: failed.map(({ table, id }) => ({ table, id })),
    });
  }
  return { mode: live ? ("moss" as const) : ("fallback" as const), indexed: indexed.length, removed: pending.removals.length };
}

/** Index public interest labels (one document per interest, kind "profile") for semantic matching. */
export async function syncProfiles(client: ConvexHttpClient) {
  const secret = serverSecret();
  if (!mossConfigured()) return;
  // If the index is missing in Moss, rebuild from every profile rather than trusting Convex's flags.
  const rebuild = !(await indexReady(KINDRED_INDEX));
  const rows = await client.query(api.matching.profilesForIndex, { secret, all: rebuild });
  if (!rows.length) return;
  try {
    const docs = rows.flatMap((r) =>
      r.interests.map((label, i) => ({ id: `${r.userId}--${i}`, text: label, metadata: { kind: "profile", userId: r.userId, role: r.role, label } })),
    );
    const stale = rebuild ? [] : rows.flatMap((r) => r.oldDocIds.filter((id) => !docs.some((d) => d.id === id)));
    if (stale.length) await deleteDocs(KINDRED_INDEX, stale);
    const { latencyMs } = await upsertDocs(KINDRED_INDEX, docs);
    await client.mutation(api.matching.markProfilesIndexed, {
      secret,
      items: rows.map((r) => ({ userId: r.userId as Id<"users">, docIds: r.interests.map((_, i) => `${r.userId}--${i}`) })),
    });
    report(client, { service: "moss", operation: "profiles.index", status: "success", mode: "live", latencyMs, detail: `${docs.length} interest docs${rebuild ? " (index rebuilt)" : ""}` });
  } catch (e) {
    report(client, { service: "moss", operation: "profiles.index", status: "error", mode: "live", detail: (e as Error).message });
    throw e;
  }
}

/** Semantic search over interest labels of people with the given role. */
export function searchProfiles(text: string, role: string, topK = 40) {
  return search(KINDRED_INDEX, text, { topK, where: { kind: "profile", role } });
}

/** Search the caller's OWN documents (memories for seniors, learning history for students). */
export async function searchOwn(client: ConvexHttpClient, text: string, topK = 5, where?: Record<string, string>) {
  const pending = await client.query(api.mossSync.pendingForViewer, { all: !mossConfigured() });
  if (!pending.scope) return { hits: [], mode: "fallback" as const, latencyMs: 0 };
  // The owner filter comes from the authenticated Convex identity, never from the request.
  const res = await search(KINDRED_INDEX, text, {
    topK,
    where: { ...where, kind: pending.scope.kind, ownerId: pending.scope.ownerId },
    fallbackCorpus: pending.upserts.map((d) => ({ id: d.id, text: d.text, metadata: d.metadata })),
  });
  // Re-check every hit in Convex; drop and clean up documents Convex no longer vouches for.
  if (res.mode === "moss" && res.hits.length) {
    const { valid, orphans } = await client.query(api.mossSync.resolveHits, { ids: res.hits.map((h) => h.id) });
    res.hits = res.hits.filter((h) => valid.includes(h.id));
    const fresh = orphans.filter((id) => !cleaning.has(id));
    if (fresh.length) {
      fresh.forEach((id) => cleaning.add(id));
      deleteDocs(KINDRED_INDEX, fresh)
        .catch(() => {})
        .finally(() => fresh.forEach((id) => cleaning.delete(id)));
      report(client, { service: "moss", operation: "index.cleanup", status: "success", mode: "live", detail: `${fresh.length} orphaned docs removed` });
    }
  }
  report(client, {
    service: "moss",
    operation: "retrieval.query",
    status: res.mode === "moss" ? "success" : "fallback",
    mode: res.mode === "moss" ? "live" : "demo",
    latencyMs: res.latencyMs,
    detail: `${res.hits.length} hits${res.mode === "fallback" ? " (lexicon fallback)" : ""}`,
  });
  return res;
}

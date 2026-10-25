// Moss index bookkeeping. Convex is the source of truth; these functions expose the caller's
// OWN pending documents to the Next.js Moss service and record the resulting Moss doc ids.
import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getConsent, requireUser } from "./lib/authz";

// All Kindred documents live in ONE shared Moss index (see src/lib/server/moss.ts), tagged with
// `kind` and `ownerId`. Personal retrieval is always filtered by the authenticated owner's id and
// every hit is re-checked in Convex, so users can only ever retrieve their own documents.
export type MossScope = { kind: "memory" | "insight"; ownerId: string };

function fmtDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export const pendingForViewer = query({
  // all=true returns every eligible document (used to build the fallback corpus or rebuild an index)
  args: { all: v.optional(v.boolean()) },
  handler: async (ctx, { all }) => {
    const user = await requireUser(ctx);
    const consent = await getConsent(ctx, user._id);
    const upserts: Array<{ table: "memoryEntries" | "learningInsights"; id: string; text: string; metadata: Record<string, string> }> = [];
    const removals: Array<{ table: "memoryEntries" | "learningInsights"; id: string }> = [];
    let scope: MossScope | null = null;
    if (user.role === "senior") {
      scope = { kind: "memory", ownerId: user._id };
      const rows = await ctx.db.query("memoryEntries").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect();
      for (const m of rows) {
        if (m.mossStatus === "removed") { if (!all) removals.push({ table: "memoryEntries", id: m._id }); }
        else if ((all ? m.mossStatus !== "skipped" : m.mossStatus === "pending" || m.mossStatus === "error") && m.approved && consent?.indexInMoss)
          upserts.push({
            table: "memoryEntries",
            id: m._id,
            text: [
              `${m.title}. On ${fmtDate(m.date)} you talked with ${m.buddyName}.`,
              m.summary,
              m.stories.length ? `Stories: ${m.stories.join(" ")}` : "",
              m.moments.length ? `Moments: ${m.moments.join(" ")}` : "",
              m.topics.length ? `Topics: ${m.topics.join(", ")}` : "",
              m.reflection ? `My reflection: ${m.reflection}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            metadata: { kind: "memory", ownerId: user._id, buddyId: m.buddyId ?? "", buddyName: m.buddyName, date: fmtDate(m.date) },
          });
      }
    } else if (user.role === "student") {
      scope = { kind: "insight", ownerId: user._id };
      const rows = await ctx.db.query("learningInsights").withIndex("by_student", (q) => q.eq("studentId", user._id)).collect();
      for (const l of rows) {
        if (l.mossStatus === "removed") { if (!all) removals.push({ table: "learningInsights", id: l._id }); }
        else if ((all ? l.mossStatus !== "skipped" : l.mossStatus === "pending" || l.mossStatus === "error") && consent?.indexInMoss)
          upserts.push({
            table: "learningInsights",
            id: l._id,
            text: [
              `Conversation${l.buddyName ? ` with ${l.buddyName}` : ""} on ${fmtDate(l.createdAt)} about ${l.topics.join(", ")}.`,
              `Weaknesses: ${l.weaknessTags.join(", ")}.`,
              ...l.topImprovements.map((t) => `${t.title}: ${t.detail}${t.example ? ` (said: "${t.example}")` : ""}`),
              ...l.grammar.patterns.map((p) => `Grammar ${p.pattern}: said "${p.heard}", better "${p.better}".`),
              ...l.vocabulary.suggestions.map((s) => `Vocabulary: instead of "${s.instead}" try "${s.try}".`),
            ].join("\n"),
            metadata: { kind: "insight", ownerId: user._id, topics: l.topics.join(", "), date: fmtDate(l.createdAt), buddyName: l.buddyName ?? "" },
          });
      }
    }
    return { scope, upserts, removals, indexingAllowed: Boolean(consent?.indexInMoss) };
  },
});

export const markSynced = mutation({
  args: {
    indexed: v.array(v.object({ table: v.union(v.literal("memoryEntries"), v.literal("learningInsights")), id: v.string() })),
    removed: v.array(v.object({ table: v.union(v.literal("memoryEntries"), v.literal("learningInsights")), id: v.string() })),
    failed: v.optional(v.array(v.object({ table: v.union(v.literal("memoryEntries"), v.literal("learningInsights")), id: v.string() }))),
  },
  handler: async (ctx, { indexed, removed, failed }) => {
    const user = await requireUser(ctx);
    const check = async (table: "memoryEntries" | "learningInsights", id: string) => {
      const norm = ctx.db.normalizeId(table, id);
      if (!norm) throw new ConvexError("Bad id");
      const doc = await ctx.db.get(norm);
      if (!doc) return null; // already gone (e.g. a concurrent sync deleted the tombstone)
      const owner = "ownerId" in doc ? doc.ownerId : doc.studentId;
      if (owner !== user._id) throw new ConvexError("Not yours");
      return doc;
    };
    for (const it of indexed) {
      const doc = await check(it.table, it.id);
      if (!doc) continue;
      await ctx.db.patch(doc._id, { mossStatus: "indexed", mossDocId: it.id, mossIndexedAt: Date.now() });
    }
    for (const it of removed) {
      const doc = await check(it.table, it.id);
      if (!doc) continue;
      if (doc.mossStatus === "removed" && (doc as { summary?: string }).summary === "") await ctx.db.delete(doc._id);
      else await ctx.db.patch(doc._id, { mossStatus: "skipped", mossDocId: undefined });
    }
    for (const it of failed ?? []) {
      const doc = await check(it.table, it.id);
      if (!doc) continue;
      await ctx.db.patch(doc._id, { mossStatus: "error" });
    }
  },
});

/** Count shown in the UI so users can see their memory is searchable. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows =
      user.role === "senior"
        ? await ctx.db.query("memoryEntries").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect()
        : await ctx.db.query("learningInsights").withIndex("by_student", (q) => q.eq("studentId", user._id)).collect();
    return {
      indexed: rows.filter((r) => r.mossStatus === "indexed").length,
      pending: rows.filter((r) => r.mossStatus === "pending" || r.mossStatus === "removed").length,
      errors: rows.filter((r) => r.mossStatus === "error").length,
      total: rows.filter((r) => r.mossStatus !== "removed").length,
    };
  },
});

/**
 * Marks every indexed document as pending so the app re-sends it to Moss on next use.
 * Used after moving to a new index:  npx convex run mossSync:reindexAll
 */
export const reindexAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    let n = 0;
    for (const p of await ctx.db.query("profiles").collect())
      if (p.mossStatus !== "pending") { await ctx.db.patch(p._id, { mossStatus: "pending" }); n++; }
    for (const m of await ctx.db.query("memoryEntries").collect())
      if (m.mossStatus === "indexed" || m.mossStatus === "error") { await ctx.db.patch(m._id, { mossStatus: "pending" }); n++; }
    for (const l of await ctx.db.query("learningInsights").collect())
      if (l.mossStatus === "indexed" || l.mossStatus === "error") { await ctx.db.patch(l._id, { mossStatus: "pending" }); n++; }
    return `${n} documents queued for re-indexing`;
  },
});

/**
 * Moss hits are untrusted: resolve them against Convex and keep only documents that still exist,
 * belong to the caller, aren't tombstoned, and (for memories) are approved. Returns the rest as
 * `orphans` so the service layer can delete them from Moss.
 */
export const resolveHits = query({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    const user = await requireUser(ctx);
    const valid: string[] = [];
    const orphans: string[] = [];
    for (const id of ids) {
      const m = ctx.db.normalizeId("memoryEntries", id);
      const l = ctx.db.normalizeId("learningInsights", id);
      const doc = m ? await ctx.db.get(m) : l ? await ctx.db.get(l) : null;
      if (!doc) {
        orphans.push(id);
        continue;
      }
      const owner = "ownerId" in doc ? doc.ownerId : doc.studentId;
      const ok = owner === user._id && doc.mossStatus !== "removed" && ("approved" in doc ? doc.approved : true);
      if (ok) valid.push(id);
      // Documents owned by someone else are never reported as orphans (and never returned).
      else if (owner === user._id) orphans.push(id);
    }
    return { valid, orphans };
  },
});

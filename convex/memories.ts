import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getConsent, requireRole } from "./lib/authz";

/** Deleted entries become empty tombstones until Moss confirms removal. */
const isTombstone = (m: Doc<"memoryEntries">) => m.mossStatus === "removed" && m.summary === "";

async function own(ctx: QueryCtx, id: Id<"memoryEntries">, userId: Id<"users">) {
  const m = await ctx.db.get(id);
  if (!m || m.ownerId !== userId || isTombstone(m)) throw new ConvexError("Memory not found.");
  return m;
}

async function withPhoto(ctx: QueryCtx, m: Doc<"memoryEntries">) {
  return { ...m, photoUrl: m.photoStorageId ? await ctx.storage.getUrl(m.photoStorageId) : null };
}

export const list = query({
  args: { buddyId: v.optional(v.id("users")), favoritesOnly: v.optional(v.boolean()) },
  handler: async (ctx, { buddyId, favoritesOnly }) => {
    const user = await requireRole(ctx, "senior");
    let rows = await ctx.db.query("memoryEntries").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).order("desc").collect();
    rows = rows.filter((m) => !isTombstone(m));
    if (buddyId) rows = rows.filter((m) => m.buddyId === buddyId);
    if (favoritesOnly) rows = rows.filter((m) => m.favorite);
    return Promise.all(rows.map((m) => withPhoto(ctx, m)));
  },
});

/** Resolve Moss hits to entries — always re-checking ownership server-side. */
export const getMany = query({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    const user = await requireRole(ctx, "senior");
    const out = [];
    for (const id of ids) {
      const norm = ctx.db.normalizeId("memoryEntries", id);
      if (!norm) continue;
      const m = await ctx.db.get(norm);
      if (m && m.ownerId === user._id && !isTombstone(m) && m.approved) out.push(await withPhoto(ctx, m));
    }
    return out;
  },
});

export const highlights = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, "senior");
    const rows = (await ctx.db.query("memoryEntries").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).order("desc").take(30)).filter((m) => !isTombstone(m));
    const favs = rows.filter((m) => m.favorite);
    const pick = [...favs, ...rows.filter((m) => !m.favorite)].slice(0, 3);
    return {
      highlights: await Promise.all(pick.map((m) => withPhoto(ctx, m))),
      drafts: rows.filter((m) => !m.approved).length,
      total: rows.length,
    };
  },
});

const editable = {
  title: v.optional(v.string()),
  summary: v.optional(v.string()),
  stories: v.optional(v.array(v.string())),
  moments: v.optional(v.array(v.string())),
  topics: v.optional(v.array(v.string())),
  nextTopics: v.optional(v.array(v.string())),
  reflection: v.optional(v.string()),
};

export const update = mutation({
  args: { id: v.id("memoryEntries"), ...editable },
  handler: async (ctx, { id, ...fields }) => {
    const user = await requireRole(ctx, "senior");
    const m = await own(ctx, id, user._id);
    const clean = Object.fromEntries(Object.entries(fields).filter(([, val]) => val !== undefined));
    await ctx.db.patch(m._id, { ...clean, updatedAt: Date.now(), ...(m.mossStatus === "indexed" ? { mossStatus: "pending" as const } : {}) });
  },
});

/** Approving a memory makes it eligible for Moss indexing (if the senior allows indexing). */
export const approve = mutation({
  args: { id: v.id("memoryEntries"), approved: v.boolean() },
  handler: async (ctx, { id, approved }) => {
    const user = await requireRole(ctx, "senior");
    const m = await own(ctx, id, user._id);
    const consent = await getConsent(ctx, user._id);
    const mossStatus = approved && consent?.indexInMoss ? "pending" : m.mossStatus === "indexed" ? "removed" : "skipped";
    // "removed" with content intact = keep the entry but queue its removal from search.
    await ctx.db.patch(m._id, { approved, mossStatus, updatedAt: Date.now() });
  },
});

export const toggleFavorite = mutation({
  args: { id: v.id("memoryEntries") },
  handler: async (ctx, { id }) => {
    const user = await requireRole(ctx, "senior");
    const m = await own(ctx, id, user._id);
    await ctx.db.patch(m._id, { favorite: !m.favorite });
  },
});

export const remove = mutation({
  args: { id: v.id("memoryEntries") },
  handler: async (ctx, { id }) => {
    const user = await requireRole(ctx, "senior");
    const m = await own(ctx, id, user._id);
    if (m.photoStorageId) await ctx.storage.delete(m.photoStorageId);
    if (m.mossStatus === "indexed" || m.mossStatus === "pending") {
      // Tombstone so the Moss service can delete the indexed document, then it is hard-deleted.
      await ctx.db.patch(m._id, { mossStatus: "removed", title: "Deleted", summary: "", stories: [], moments: [], reflection: undefined, photoStorageId: undefined });
    } else await ctx.db.delete(m._id);
  },
});

export const createManual = mutation({
  args: { title: v.string(), summary: v.string(), buddyId: v.optional(v.id("users")), date: v.optional(v.number()) },
  handler: async (ctx, { title, summary, buddyId, date }) => {
    const user = await requireRole(ctx, "senior");
    const consent = await getConsent(ctx, user._id);
    let buddyName = "Just me";
    if (buddyId) {
      const p = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", buddyId)).unique();
      buddyName = p?.name ?? buddyName;
    }
    return ctx.db.insert("memoryEntries", {
      ownerId: user._id,
      buddyId,
      buddyName,
      date: date ?? Date.now(),
      title,
      summary,
      topics: [],
      stories: [],
      moments: [],
      sharedInterests: [],
      nextTopics: [],
      favorite: false,
      approved: true,
      source: "manual",
      mossStatus: consent?.indexInMoss ? "pending" : "skipped",
      updatedAt: Date.now(),
    });
  },
});

export const photoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "senior");
    return ctx.storage.generateUploadUrl();
  },
});

export const attachPhoto = mutation({
  args: { id: v.id("memoryEntries"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }) => {
    const user = await requireRole(ctx, "senior");
    const m = await own(ctx, id, user._id);
    if (m.photoStorageId) await ctx.storage.delete(m.photoStorageId);
    await ctx.db.patch(m._id, { photoStorageId: storageId });
  },
});

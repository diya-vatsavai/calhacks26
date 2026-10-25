// The Lamb: Kindred's in-call assistant for students.
// This module is the Lamb's memory and its brakes; the reasoning lives in lambAI.ts (node runtime,
// so the LLM SDK can load). Retrieval is not here: Moss indexes are loaded in the Next.js service
// process, which passes the retrieved history into the action (same split as the Practice Studio).
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getConsent, getProfile, requireRole, requireUser } from "./lib/authz";
import { DEFAULT_SUPPORT, momentKindV, supportV, triggerV, type Support } from "./lib/lambLadder";

/** The caller's saved Lamb settings (students only; seniors get captions but no Lamb). */
export const prefs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { support: DEFAULT_SUPPORT, captions: true, translate: true };
    const row = await ctx.db.query("lambPrefs").withIndex("by_student", (q) => q.eq("studentId", userId)).unique();
    return {
      support: (row?.support ?? DEFAULT_SUPPORT) as Support,
      captions: row?.captions ?? true,
      translate: row?.translate ?? true,
    };
  },
});

export const setPrefs = mutation({
  args: { support: v.optional(supportV), captions: v.optional(v.boolean()), translate: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "student");
    const row = await ctx.db.query("lambPrefs").withIndex("by_student", (q) => q.eq("studentId", user._id)).unique();
    const patch = {
      ...(args.support ? { support: args.support } : {}),
      ...(args.captions !== undefined ? { captions: args.captions } : {}),
      ...(args.translate !== undefined ? { translate: args.translate } : {}),
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, patch);
    else
      await ctx.db.insert("lambPrefs", {
        studentId: user._id,
        support: args.support ?? DEFAULT_SUPPORT,
        captions: args.captions ?? true,
        translate: args.translate ?? true,
        updatedAt: Date.now(),
      });
  },
});

/** The Convex-side truth about this call, used by the Next.js route to ground a request. */
export const session = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in.");
    const conv = await ctx.db.get(conversationId);
    if (!conv || (conv.studentId !== userId && conv.seniorId !== userId)) throw new ConvexError("That call isn't available.");
    const [student, senior, rel, consent] = await Promise.all([
      getProfile(ctx, conv.studentId),
      getProfile(ctx, conv.seniorId),
      ctx.db.get(conv.relationshipId),
      getConsent(ctx, conv.studentId),
    ]);
    // What this pair talked about last time, from the senior's approved-or-draft Memory Book entries.
    const memories = await ctx.db
      .query("memoryEntries")
      .withIndex("by_owner_buddy", (q) => q.eq("ownerId", conv.seniorId).eq("buddyId", conv.studentId))
      .order("desc")
      .take(3);
    const insights = await ctx.db
      .query("learningInsights")
      .withIndex("by_student", (q) => q.eq("studentId", conv.studentId))
      .order("desc")
      .take(2);
    return {
      conversationId,
      isStudent: conv.studentId === userId,
      consented: conv.studentConsent && conv.seniorConsent,
      // Live in-call assistance is only offered when the student actually agreed to it.
      allowed: Boolean(consent?.transcribe && consent?.learningFeedback),
      student: student
        ? {
            name: student.name.split(" ")[0],
            proficiency: student.proficiency,
            nativeLanguage: student.nativeLanguage,
            goals: student.learningGoals ?? [],
          }
        : null,
      buddy: { name: senior?.name.split(" ")[0] ?? "your buddy" },
      topics: [
        ...new Set([
          ...(rel?.sharedInterests ?? []),
          ...memories.flatMap((m) => m.nextTopics),
          ...memories.flatMap((m) => m.topics.slice(0, 2)),
        ]),
      ].slice(0, 6),
      focus: [...new Set(insights.flatMap((i) => i.weaknessTags))].slice(0, 3),
    };
  },
});

/** Live captions for this call (oldest first, bounded for the in-call overlay). */
export const captions = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const user = await requireUser(ctx);
    const conv = await ctx.db.get(conversationId);
    if (!conv || (conv.studentId !== user._id && conv.seniorId !== user._id)) return [];
    const rows = await ctx.db
      .query("callCaptions")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(12);
    return rows.reverse().map((c) => ({ _id: c._id, speaker: c.speaker, text: c.text, createdAt: c.createdAt }));
  },
});

/** Called by the Next.js caption service with one transcribed segment. */
export const addCaption = mutation({
  args: {
    conversationId: v.id("conversations"),
    speaker: v.union(v.literal("self"), v.literal("buddy")),
    text: v.string(),
    latencyMs: v.number(),
    durationSec: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || (conv.studentId !== user._id && conv.seniorId !== user._id)) throw new ConvexError("That call isn't available.");
    if (!(conv.studentConsent && conv.seniorConsent)) throw new ConvexError("Captions need both people to agree to transcription.");
    const mine = conv.studentId === user._id ? "student" : "senior";
    const speaker: "student" | "senior" = args.speaker === "self" ? mine : mine === "student" ? "senior" : "student";
    const text = args.text.trim().slice(0, 500);
    if (!text) return null;
    return ctx.db.insert("callCaptions", {
      conversationId: args.conversationId,
      speaker,
      text,
      latencyMs: Math.round(args.latencyMs),
      durationSec: Math.round(args.durationSec),
      createdAt: Date.now(),
    });
  },
});

/** Moments the student hasn't dismissed, oldest first. */
export const moments = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const user = await requireUser(ctx);
    const conv = await ctx.db.get(conversationId);
    if (!conv || conv.studentId !== user._id) return [];
    const rows = await ctx.db
      .query("lambMoments")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(24);
    return rows
      .filter((m) => !m.dismissedAt)
      .reverse()
      .map((m) => ({
        _id: m._id,
        kind: m.kind,
        trigger: m.trigger,
        text: m.text,
        detail: m.detail,
        phrase: m.phrase,
        source: m.source,
        createdAt: m.createdAt,
      }));
  },
});

export const dismiss = mutation({
  args: { momentId: v.id("lambMoments") },
  handler: async (ctx, { momentId }) => {
    const user = await requireUser(ctx);
    const moment = await ctx.db.get(momentId);
    if (!moment || moment.studentId !== user._id) return;
    await ctx.db.patch(momentId, { dismissedAt: Date.now() });
  },
});

/** What the Lamb helped with, for the end-of-call screen. */
export const summary = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const user = await requireUser(ctx);
    const conv = await ctx.db.get(conversationId);
    if (!conv || conv.studentId !== user._id) return null;
    const rows = await ctx.db
      .query("lambMoments")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    const words = [...new Set(rows.filter((r) => r.kind === "rescue" && r.phrase).map((r) => r.phrase!))];
    const phrases = [...new Set(rows.filter((r) => r.kind === "gloss" && r.phrase).map((r) => r.phrase!))];
    return {
      total: rows.length,
      asked: rows.filter((r) => r.trigger === "asked").length,
      sparks: rows.filter((r) => r.kind === "spark").length,
      words,
      phrases,
    };
  },
});

/** Internal view for the action: who is in this call, their level, and what was just said. */
export const context = internalQuery({
  args: { conversationId: v.id("conversations"), userId: v.id("users") },
  handler: async (ctx, { conversationId, userId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv || conv.studentId !== userId) return null;
    const [student, senior, row, consent] = await Promise.all([
      getProfile(ctx, conv.studentId),
      getProfile(ctx, conv.seniorId),
      ctx.db.query("lambPrefs").withIndex("by_student", (q) => q.eq("studentId", userId)).unique(),
      getConsent(ctx, userId),
    ]);
    const captions = await ctx.db
      .query("callCaptions")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(10);
    return {
      consented: conv.studentConsent && conv.seniorConsent,
      allowed: Boolean(consent?.transcribe && consent?.learningFeedback),
      support: (row?.support ?? DEFAULT_SUPPORT) as Support,
      student: {
        name: student?.name.split(" ")[0] ?? "there",
        proficiency: student?.proficiency,
        nativeLanguage: student?.nativeLanguage,
      },
      buddyName: senior?.name.split(" ")[0] ?? "your buddy",
      recent: captions.reverse().map((c) => ({ speaker: c.speaker, text: c.text })),
    };
  },
});

/** Proactivity so far this call — the numbers the ladder is enforced against. */
export const budget = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const rows = await ctx.db
      .query("lambMoments")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(60);
    const unasked = rows.filter((r) => r.trigger !== "asked");
    return {
      auto: unasked.length,
      gloss: unasked.filter((r) => r.kind === "gloss").length,
      lastAt: unasked[0]?.createdAt ?? null,
      dismissed: rows.filter((r) => r.dismissedAt).length,
    };
  },
});

export const record = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    studentId: v.id("users"),
    kind: momentKindV,
    trigger: triggerV,
    text: v.string(),
    detail: v.optional(v.string()),
    phrase: v.optional(v.string()),
    source: v.union(v.literal("llm"), v.literal("rules")),
    latencyMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => ctx.db.insert("lambMoments", { ...args, createdAt: Date.now() }),
});

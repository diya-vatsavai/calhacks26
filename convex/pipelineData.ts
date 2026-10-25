import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { getConsent, getProfile } from "./lib/authz";

export const load = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return null;
    const student = await getProfile(ctx, conv.studentId);
    const senior = await getProfile(ctx, conv.seniorId);
    return {
      conv,
      student,
      senior,
      studentConsent: await getConsent(ctx, conv.studentId),
      seniorConsent: await getConsent(ctx, conv.seniorId),
    };
  },
});

/** Atomically moves a conversation into processing so the pipeline runs at most once. */
export const claim = internalMutation({
  args: { conversationId: v.id("conversations"), force: v.boolean() },
  handler: async (ctx, { conversationId, force }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv || conv.processing !== "awaiting_audio" || !conv.endedAt) return false;
    if (!(conv.studentConsent && conv.seniorConsent)) return false;
    if (!force && conv.recordings.length < 2) return false;
    if (conv.recordings.length === 0) {
      await ctx.db.patch(conversationId, { processing: "failed", processingError: "No consented audio was captured during this call." });
      return false;
    }
    await ctx.db.patch(conversationId, { processing: "transcribing" });
    return true;
  },
});

export const setStatus = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    processing: v.union(v.literal("transcribing"), v.literal("analyzing"), v.literal("indexing"), v.literal("complete"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, processing, error }) => {
    await ctx.db.patch(conversationId, { processing, processingError: error });
  },
});

export const deleteAudio = internalMutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) return;
    for (const r of conv.recordings) await ctx.storage.delete(r.storageId).catch(() => {});
    await ctx.db.patch(conversationId, { recordings: [] });
  },
});

const segmentV = v.object({ speaker: v.union(v.literal("student"), v.literal("senior")), start: v.number(), end: v.number(), text: v.string() });
const metricsV = v.object({
  studentWords: v.number(),
  seniorWords: v.number(),
  studentSpeakingSec: v.number(),
  studentWpm: v.number(),
  studentLongPauses: v.number(),
  studentFillers: v.number(),
  studentShare: v.number(),
});

export const saveResults = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    storeTranscript: v.boolean(),
    segments: v.array(segmentV),
    metrics: metricsV,
    analysisSource: v.union(v.literal("llm"), v.literal("heuristic-demo")),
    analysis: v.any(),
    saveInsight: v.boolean(),
    indexInsight: v.boolean(),
    saveMemory: v.boolean(),
  },
  handler: async (ctx, a) => {
    const conv = await ctx.db.get(a.conversationId);
    if (!conv) return;
    const student = await getProfile(ctx, conv.studentId);
    const senior = await getProfile(ctx, conv.seniorId);
    const an = a.analysis;
    if (a.storeTranscript) {
      await ctx.db.insert("transcripts", {
        conversationId: conv._id,
        studentId: conv.studentId,
        seniorId: conv.seniorId,
        segments: a.segments,
        metrics: a.metrics,
        source: "cartesia-ink",
        createdAt: Date.now(),
      });
    }
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
    if (a.saveInsight) {
      const studentText = a.segments.filter((s) => s.speaker === "student").map((s) => s.text).join(" ");
      await ctx.db.insert("learningInsights", {
        studentId: conv.studentId,
        conversationId: conv._id,
        buddyName: senior?.name,
        createdAt: Date.now(),
        analysisSource: a.analysisSource,
        summary: an.student.summary,
        topics: an.sharedTopics,
        topImprovements: an.student.topImprovements.slice(0, 3).map((t: any) => ({ title: t.title, detail: t.detail, example: t.example || undefined })),
        vocabulary: {
          score: clamp(an.student.vocabulary.score),
          uniqueWords: new Set(studentText.toLowerCase().match(/[a-z']+/g) ?? []).size,
          notes: an.student.vocabulary.notes,
          suggestions: an.student.vocabulary.suggestions.slice(0, 6),
        },
        grammar: { score: clamp(an.student.grammar.score), notes: an.student.grammar.notes, patterns: an.student.grammar.patterns.slice(0, 6) },
        fluency: {
          score: clamp(an.student.fluencyScore),
          wpm: a.metrics.studentWpm,
          longPauses: a.metrics.studentLongPauses,
          fillers: a.metrics.studentFillers,
          notes: an.student.fluencyNotes,
        },
        participation: { score: clamp(an.student.participationScore), share: a.metrics.studentShare, notes: an.student.participationNotes },
        pronunciation: {
          assessed: false,
          notes: "Not scored from this call: speech-to-text shows the words you said, not how you pronounced them. Practice sounds in the Practice Studio, where Kindred compares your speech to a target sentence.",
        },
        expressions: an.student.expressions.slice(0, 5),
        weaknessTags: an.student.weaknessTags.slice(0, 6),
        mossStatus: a.indexInsight ? "pending" : "skipped",
      });
    }
    if (a.saveMemory) {
      await ctx.db.insert("memoryEntries", {
        ownerId: conv.seniorId,
        buddyId: conv.studentId,
        buddyName: student?.name ?? "your buddy",
        conversationId: conv._id,
        date: conv.startedAt,
        title: an.memory.title,
        summary: an.memory.summary,
        topics: an.memory.topics,
        stories: an.memory.stories,
        moments: an.memory.moments,
        sharedInterests: an.memory.sharedInterests,
        nextTopics: an.nextTopics,
        favorite: false,
        approved: false, // the senior reviews and approves before anything is indexed
        source: a.analysisSource,
        mossStatus: "skipped",
        updatedAt: Date.now(),
      });
    }
    await ctx.db.patch(conv._id, { sharedTopics: an.sharedTopics, nextTopics: an.nextTopics, processing: "complete", processingError: undefined });
  },
});

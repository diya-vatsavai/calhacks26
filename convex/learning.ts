import { v, ConvexError } from "convex/values";
import { query } from "./_generated/server";
import { requireRole } from "./lib/authz";

const WEEK = 7 * 24 * 3600 * 1000;

export const insights = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const user = await requireRole(ctx, "student");
    const rows = await ctx.db.query("learningInsights").withIndex("by_student", (q) => q.eq("studentId", user._id)).order("desc").take(limit ?? 20);
    return rows.filter((r) => !(r.mossStatus === "removed" && r.summary === ""));
  },
});

export const insight = query({
  args: { id: v.id("learningInsights") },
  handler: async (ctx, { id }) => {
    const user = await requireRole(ctx, "student");
    const r = await ctx.db.get(id);
    // Learning feedback is private to the student — not visible to buddies or admins.
    if (!r || r.studentId !== user._id) throw new ConvexError("Not found");
    return r;
  },
});

export const insightForConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const user = await requireRole(ctx, "student");
    const rows = await ctx.db.query("learningInsights").withIndex("by_student", (q) => q.eq("studentId", user._id)).collect();
    return rows.find((r) => r.conversationId === conversationId) ?? null;
  },
});

export const progress = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, "student");
    const insights = (await ctx.db.query("learningInsights").withIndex("by_student", (q) => q.eq("studentId", user._id)).collect()).filter(
      (r) => r.summary !== "",
    );
    const convs = await ctx.db.query("conversations").withIndex("by_student", (q) => q.eq("studentId", user._id)).collect();
    const sessions = await ctx.db.query("practiceSessions").withIndex("by_student", (q) => q.eq("studentId", user._id)).collect();

    const now = Date.now();
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const end = now - (7 - i) * WEEK;
      const start = end - WEEK;
      const callMin = convs.filter((c) => c.startedAt >= start && c.startedAt < end).reduce((n, c) => n + (c.durationSec ?? 0) / 60, 0);
      const practiceMin = sessions.filter((s) => s.startedAt >= start && s.startedAt < end).reduce((n, s) => n + s.speakingSec / 60, 0);
      const exercises = sessions.filter((s) => s.startedAt >= start && s.startedAt < end && s.attempts.length > 0).length;
      return { label: new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric" }), callMin: Math.round(callMin), practiceMin: Math.round(practiceMin * 10) / 10, exercises };
    });

    const series = insights
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({
        date: r.createdAt,
        label: new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        vocabulary: r.vocabulary.score,
        grammar: r.grammar.score,
        fluency: r.fluency.score,
        participation: r.participation.score,
        uniqueWords: r.vocabulary.uniqueWords,
        wpm: r.fluency.wpm,
        source: r.analysisSource,
      }));

    const pronAttempts = sessions.flatMap((s) => s.attempts.map((a) => ({ ...a, sessionId: s._id })));
    const tagCounts = new Map<string, number>();
    for (const r of insights) for (const t of r.weaknessTags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);

    const totalCallMin = convs.reduce((n, c) => n + (c.durationSec ?? 0) / 60, 0);
    const totalPracticeMin = sessions.reduce((n, s) => n + s.speakingSec / 60, 0);
    return {
      weeks,
      series,
      totals: {
        speakingMin: Math.round(totalCallMin + totalPracticeMin),
        callMin: Math.round(totalCallMin),
        practiceMin: Math.round(totalPracticeMin),
        conversations: convs.filter((c) => c.endedAt).length,
        exercisesCompleted: sessions.filter((s) => s.completedAt).length,
        attempts: pronAttempts.length,
        avgAttemptScore: pronAttempts.length ? Math.round(pronAttempts.reduce((n, a) => n + a.score, 0) / pronAttempts.length) : null,
      },
      recurringWeaknesses: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, count]) => ({ tag, count })),
      hasDemoData: insights.some((r) => r.analysisSource !== "llm"),
    };
  },
});

import { v, ConvexError } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireRole } from "./lib/authz";

export const exerciseTypeV = v.union(
  v.literal("pronunciation"),
  v.literal("vocabulary"),
  v.literal("roleplay"),
  v.literal("grammar"),
  v.literal("rephrasing"),
  v.literal("fluency"),
);

export const recentSessions = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, "student");
    const sessions = await ctx.db.query("practiceSessions").withIndex("by_student", (q) => q.eq("studentId", user._id)).order("desc").take(8);
    const out = [];
    for (const s of sessions) {
      const ex = await ctx.db.get(s.exerciseId);
      if (ex) out.push({ ...s, exercise: ex });
    }
    return out;
  },
});

export const session = query({
  args: { sessionId: v.id("practiceSessions") },
  handler: async (ctx, { sessionId }) => {
    const user = await requireRole(ctx, "student");
    const s = await ctx.db.get(sessionId);
    if (!s || s.studentId !== user._id) throw new ConvexError("Not found");
    const exercise = await ctx.db.get(s.exerciseId);
    return { ...s, exercise };
  },
});

/** Context for exercise generation: the student's profile plus recent weaknesses (Convex copy). */
export const contextForStudent = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    const interests = (await ctx.db.query("interests").withIndex("by_user", (q) => q.eq("userId", userId)).collect())
      .filter((i) => i.kind === "interest")
      .map((i) => i.label);
    const insights = await ctx.db.query("learningInsights").withIndex("by_student", (q) => q.eq("studentId", userId)).order("desc").take(5);
    return { profile, interests, insights: insights.filter((i) => i.summary !== "") };
  },
});

export const sessionForEval = internalQuery({
  args: { sessionId: v.id("practiceSessions"), userId: v.id("users") },
  handler: async (ctx, { sessionId, userId }) => {
    const s = await ctx.db.get(sessionId);
    if (!s || s.studentId !== userId) return null;
    const exercise = await ctx.db.get(s.exerciseId);
    return exercise ? { session: s, exercise } : null;
  },
});

export const saveExercise = internalMutation({
  args: {
    studentId: v.id("users"),
    type: exerciseTypeV,
    title: v.string(),
    focus: v.string(),
    whyThis: v.string(),
    coachIntro: v.string(),
    instructions: v.string(),
    examplePhrases: v.array(v.string()),
    targetPhrase: v.optional(v.string()),
    scenario: v.optional(v.string()),
    retrievedContext: v.array(v.object({ text: v.string(), score: v.number(), source: v.string() })),
    retrievalMode: v.union(v.literal("moss"), v.literal("fallback"), v.literal("none")),
    generatedBy: v.union(v.literal("llm"), v.literal("template-demo")),
  },
  handler: async (ctx, args) => {
    const exerciseId = await ctx.db.insert("practiceExercises", { ...args, createdAt: Date.now() });
    const sessionId = await ctx.db.insert("practiceSessions", {
      studentId: args.studentId,
      exerciseId,
      startedAt: Date.now(),
      attempts: [],
      speakingSec: 0,
    });
    return { exerciseId, sessionId };
  },
});

export const appendAttempt = internalMutation({
  args: {
    sessionId: v.id("practiceSessions"),
    attempt: v.object({
      transcript: v.string(),
      sttSource: v.union(v.literal("cartesia-ink"), v.literal("typed")),
      durationSec: v.number(),
      wpm: v.number(),
      score: v.number(),
      feedback: v.string(),
      corrections: v.array(v.object({ heard: v.string(), better: v.string() })),
      missedTargetWords: v.array(v.string()),
      coachReply: v.string(),
      at: v.number(),
    }),
    done: v.boolean(),
  },
  handler: async (ctx, { sessionId, attempt, done }) => {
    const s = await ctx.db.get(sessionId);
    if (!s) return;
    await ctx.db.patch(sessionId, {
      attempts: [...s.attempts, attempt],
      speakingSec: s.speakingSec + attempt.durationSec,
      ...(done && !s.completedAt ? { completedAt: Date.now() } : {}),
    });
  },
});

export const complete = mutation({
  args: { sessionId: v.id("practiceSessions") },
  handler: async (ctx, { sessionId }) => {
    const user = await requireRole(ctx, "student");
    const s = await ctx.db.get(sessionId);
    if (!s || s.studentId !== user._id) throw new ConvexError("Not found");
    if (!s.completedAt) await ctx.db.patch(sessionId, { completedAt: Date.now() });
  },
});

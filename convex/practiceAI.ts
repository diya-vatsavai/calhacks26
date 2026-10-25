"use node";
// Practice Studio reasoning: personalized exercise generation and spoken-answer feedback.
// Retrieval (Moss) and audio (Cartesia Sonic/Ink) happen in the Next.js service layer, which
// passes the retrieved context and the Ink transcript in here.
import { v, ConvexError } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { evaluateAttempt, generateExercise, llmConfigured, llmModel } from "./lib/llm";
import { ruleCorrections } from "./lib/heuristics";
import type { Doc, Id } from "./_generated/dataModel";

const typeV = v.union(
  v.literal("pronunciation"),
  v.literal("vocabulary"),
  v.literal("roleplay"),
  v.literal("grammar"),
  v.literal("rephrasing"),
  v.literal("fluency"),
);
type ExType = "pronunciation" | "vocabulary" | "roleplay" | "grammar" | "rephrasing" | "fluency";

function templateExercise(type: ExType | undefined, weakness: string | undefined, interest: string, name: string) {
  const t: ExType = type ?? (weakness?.includes("past") ? "roleplay" : "fluency");
  const focus = weakness ?? "speaking fluency";
  const base = {
    pronunciation: {
      title: `Say it clearly: ${interest}`,
      instructions: "Listen, then repeat the sentence at a comfortable pace.",
      targetPhrase: `I think the most wonderful thing about ${interest} is that it brings people together.`,
      scenario: "",
    },
    vocabulary: {
      title: `Describe ${interest} with richer words`,
      instructions: "Describe something you love about this topic. Try to use two words from the examples.",
      targetPhrase: "",
      scenario: "",
    },
    roleplay: {
      title: `Tell a ${interest} story in the past`,
      instructions: "Your coach is a curious friend. Tell them about a time you enjoyed this — using past-tense verbs.",
      targetPhrase: "",
      scenario: `You're catching up with a friend who asks: "What did you do last weekend?"`,
    },
    grammar: {
      title: "Fix the sentence",
      instructions: 'Say this sentence correctly: "Yesterday I go to the market and buy many flower."',
      targetPhrase: "",
      scenario: "",
    },
    rephrasing: {
      title: "Say it another way",
      instructions: 'Rephrase this more naturally: "The weather was very very good and the place was very nice."',
      targetPhrase: "",
      scenario: "",
    },
    fluency: {
      title: `Talk for 45 seconds about ${interest}`,
      instructions: "Keep talking without stopping. Use connectors like 'and then', 'because', 'after that'.",
      targetPhrase: "",
      scenario: "",
    },
  }[t];
  return {
    type: t,
    focus,
    whyThis: weakness ? `Your recent feedback mentioned ${weakness}.` : `Based on your learning goals (no conversation history yet).`,
    coachIntro: `Hi ${name}! Let's practice together. ${base.instructions}`,
    examplePhrases: [`When I was younger, I loved ${interest}.`, `Last summer, I spent a lot of time on ${interest}.`],
    ...base,
  };
}

export const generate = action({
  args: {
    requestedType: v.optional(typeV),
    retrieved: v.array(v.object({ text: v.string(), score: v.number(), source: v.string() })),
    retrievalMode: v.union(v.literal("moss"), v.literal("fallback"), v.literal("none")),
  },
  handler: async (ctx, { requestedType, retrieved, retrievalMode }): Promise<{ exerciseId: Id<"practiceExercises">; sessionId: Id<"practiceSessions"> }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in.");
    const { profile, interests, insights } = await ctx.runQuery(internal.practice.contextForStudent, { userId });
    if (!profile || profile.role !== "student") throw new ConvexError("The Practice Studio is for students.");

    let ex: ReturnType<typeof templateExercise> | null = null;
    let generatedBy: "llm" | "template-demo" = "llm";
    if (llmConfigured()) {
      try {
        const t0 = Date.now();
        const { data } = await generateExercise({
          name: profile.name,
          proficiency: profile.proficiency,
          goals: profile.learningGoals ?? [],
          interests,
          requestedType,
          retrieved: retrieved.map((r) => ({ text: r.text, source: r.source })),
        });
        ex = { ...data, targetPhrase: data.targetPhrase || "", scenario: data.scenario || "" };
        await ctx.runMutation(internal.integrations.record, { service: "llm", operation: "practice.generate", status: "success", mode: "live", latencyMs: Date.now() - t0, detail: `${data.type} · ${llmModel()}` });
      } catch (e) {
        await ctx.runMutation(internal.integrations.record, { service: "llm", operation: "practice.generate", status: "error", mode: "live", detail: (e as Error).message });
      }
    } else {
      await ctx.runMutation(internal.integrations.record, { service: "llm", operation: "practice.generate", status: "fallback", mode: "demo", detail: "ANTHROPIC_API_KEY not set — template exercise" });
    }
    if (!ex) {
      generatedBy = "template-demo";
      const weakness = insights[0]?.weaknessTags[0];
      const topic = insights[0]?.topics[0] ?? interests[0] ?? "travel";
      ex = templateExercise(requestedType, weakness, topic, profile.name.split(" ")[0]);
    }
    return ctx.runMutation(internal.practice.saveExercise, {
      studentId: userId,
      type: ex.type,
      title: ex.title,
      focus: ex.focus,
      whyThis: ex.whyThis,
      coachIntro: ex.coachIntro,
      instructions: ex.instructions,
      examplePhrases: ex.examplePhrases.slice(0, 3),
      targetPhrase: ex.targetPhrase || undefined,
      scenario: ex.scenario || undefined,
      retrievedContext: retrieved.slice(0, 5).map((r) => ({ ...r, text: r.text.slice(0, 400) })),
      retrievalMode,
      generatedBy,
    });
  },
});

const norm = (w: string) => w.toLowerCase().replace(/[^a-z']/g, "");

type AttemptResult = {
  transcript: string;
  sttSource: "cartesia-ink" | "typed";
  durationSec: number;
  wpm: number;
  score: number;
  feedback: string;
  corrections: Array<{ heard: string; better: string }>;
  missedTargetWords: string[];
  coachReply: string;
  at: number;
  done: boolean;
};

export const evaluate = action({
  args: {
    sessionId: v.id("practiceSessions"),
    transcript: v.string(),
    durationSec: v.number(),
    wordCount: v.number(),
    sttSource: v.union(v.literal("cartesia-ink"), v.literal("typed")),
  },
  handler: async (ctx, args): Promise<AttemptResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in.");
    const found: { session: Doc<"practiceSessions">; exercise: Doc<"practiceExercises"> } | null = await ctx.runQuery(internal.practice.sessionForEval, { sessionId: args.sessionId, userId });
    if (!found) throw new ConvexError("Practice session not found.");
    const { session, exercise } = found;
    const transcript = args.transcript.trim();
    if (!transcript) throw new ConvexError("We didn't catch anything — try speaking a little closer to the microphone.");

    // Evidence-based pronunciation signal: target words Ink did not recognize in the audio.
    let missedTargetWords: string[] = [];
    if (exercise.targetPhrase && args.sttSource === "cartesia-ink") {
      const heard = new Set(transcript.split(/\s+/).map(norm));
      missedTargetWords = [...new Set(exercise.targetPhrase.split(/\s+/).map(norm))].filter((w) => w.length > 3 && !heard.has(w));
    }
    const minutes = Math.max(args.durationSec, 1) / 60;
    const wpm = Math.round(args.wordCount / minutes);

    let result: { score: number; feedback: string; corrections: Array<{ heard: string; better: string }>; coachReply: string; done: boolean } | null = null;
    if (llmConfigured()) {
      try {
        const t0 = Date.now();
        const { data } = await evaluateAttempt({
          exercise,
          history: session.attempts.map((a) => ({ transcript: a.transcript, coachReply: a.coachReply })),
          transcript,
          missedTargetWords,
          wpm,
          sttSource: args.sttSource,
        });
        result = data;
        await ctx.runMutation(internal.integrations.record, { service: "llm", operation: "practice.evaluate", status: "success", mode: "live", latencyMs: Date.now() - t0, detail: llmModel() });
      } catch (e) {
        await ctx.runMutation(internal.integrations.record, { service: "llm", operation: "practice.evaluate", status: "error", mode: "live", detail: (e as Error).message });
      }
    }
    if (!result) {
      const words = transcript.split(/\s+/).length;
      const corrections = ruleCorrections(transcript);
      const score = exercise.targetPhrase
        ? Math.round(100 * (1 - missedTargetWords.length / Math.max(1, exercise.targetPhrase.split(/\s+/).filter((w: string) => w.length > 3).length)))
        : Math.max(40, Math.min(95, 50 + words * 2 - corrections.length * 15));
      result = {
        score,
        feedback: `${missedTargetWords.length ? `Ink didn't clearly hear: ${missedTargetWords.join(", ")}. ` : ""}${corrections.length ? `The rule checker found ${corrections.length} thing${corrections.length > 1 ? "s" : ""} to fix. ` : ""}You used ${words} words. (Rule-based demo feedback — add an LLM key for full coaching.)`,
        corrections,
        coachReply: missedTargetWords.length
          ? `Nice try! Let's say "${missedTargetWords[0]}" slowly together, then try the whole sentence again.`
          : corrections.length
            ? `Good effort! Try saying it like this: ${corrections[0].better}`
            : "Well done! Want to try another one?",
        done: missedTargetWords.length === 0 && corrections.length === 0 && score >= 70,
      };
    }
    const attempt = {
      transcript: transcript.slice(0, 2000),
      sttSource: args.sttSource,
      durationSec: Math.round(args.durationSec),
      wpm,
      score: Math.max(0, Math.min(100, Math.round(result.score))),
      feedback: result.feedback,
      corrections: result.corrections.slice(0, 5),
      missedTargetWords,
      coachReply: result.coachReply,
      at: Date.now(),
    };
    await ctx.runMutation(internal.practice.appendAttempt, { sessionId: args.sessionId, attempt, done: result.done });
    return { ...attempt, done: result.done };
  },
});

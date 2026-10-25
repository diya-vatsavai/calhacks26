"use node";
// The Lamb's reasoning. One action for all three kinds of help, because they share the same
// consent check, the same proactivity budget and the same telemetry.
//
// Who decides what:
//   client  – notices a stall, a lull or a tricky phrase and *asks* (see src/lib/lamb.ts)
//   here    – decides whether the Lamb may answer unasked (the ladder in lamb.ts), grounds
//             itself in the Moss retrieval passed in by the Next.js service layer, and falls
//             back to rules rather than failing when no model is configured.
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { lambGloss, lambRescue, lambSpark, llmConfigured, llmModel } from "./lib/llm";
import { LADDER, momentKindV, triggerV } from "./lib/lambLadder";

export type AssistResult = {
  skipped?: "not-student" | "not-consented" | "not-allowed" | "budget" | "cooldown" | "no-model";
  moment?: {
    _id: string;
    kind: "spark" | "rescue" | "gloss";
    trigger: "asked" | "hesitation" | "lull" | "rare_phrase";
    text: string;
    detail?: string;
    phrase?: string;
    source: "llm" | "rules";
    latencyMs?: number;
  };
};

export const assist = action({
  args: {
    conversationId: v.id("conversations"),
    kind: momentKindV,
    trigger: triggerV,
    phrase: v.optional(v.string()),
    stall: v.optional(v.string()),
    topics: v.array(v.string()),
    focus: v.array(v.string()),
    retrieved: v.array(v.object({ text: v.string(), score: v.number(), source: v.string() })),
    retrievalMode: v.union(v.literal("moss"), v.literal("fallback"), v.literal("none")),
  },
  handler: async (ctx, args): Promise<AssistResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { skipped: "not-student" };
    const data = await ctx.runQuery(internal.lamb.context, { conversationId: args.conversationId, userId });
    if (!data) return { skipped: "not-student" };
    if (!data.consented) return { skipped: "not-consented" };
    if (!data.allowed) return { skipped: "not-allowed" };

    // The student's saved support level is the server's truth, not whatever the tab sent.
    const ladder = LADDER[data.support];
    if (args.trigger !== "asked") {
      if (ladder.auto === 0) return { skipped: "budget" };
      const used = await ctx.runQuery(internal.lamb.budget, { conversationId: args.conversationId });
      if (used.auto >= ladder.auto) return { skipped: "budget" };
      if (used.lastAt && Date.now() - used.lastAt < ladder.cooldownMs) return { skipped: "cooldown" };
      if (args.kind === "gloss" && used.gloss >= ladder.gloss) return { skipped: "budget" };
    }

    const phrase = args.phrase?.trim().slice(0, 120) || undefined;
    let rescued: string | undefined;
    const stall =
      args.stall?.trim().slice(0, 400) ||
      data.recent
        .filter((r) => r.speaker === "student")
        .slice(-2)
        .map((r) => r.text)
        .join(" ");
    let text = "";
    let detail = "";
    let source: "llm" | "rules" = "rules";
    let latencyMs: number | undefined;

    if (llmConfigured()) {
      const t0 = Date.now();
      try {
        if (args.kind === "spark") {
          const r = await lambSpark({
            name: data.student.name,
            proficiency: data.student.proficiency,
            buddyName: data.buddyName,
            topics: args.topics,
            focus: args.focus,
            retrieved: args.retrieved.map((r) => ({ text: r.text, source: r.source })),
            quietSec: 30,
          });
          text = r.data.text.trim();
          detail = r.data.detail.trim();
          source = "llm";
        } else if (args.kind === "rescue") {
          const r = await lambRescue({
            proficiency: data.student.proficiency,
            nativeLanguage: data.student.nativeLanguage,
            stall: stall || "(they did not say anything yet)",
            recent: data.recent,
            topics: args.topics,
            focus: args.focus,
          });
          text = r.data.meaning.trim();
          detail = r.data.sayThis.trim();
          source = "llm";
          rescued = r.data.word.trim() || phrase;
        } else {
          const r = await lambGloss({
            phrase: phrase ?? "",
            context: stall,
            nativeLanguage: data.student.nativeLanguage,
            proficiency: data.student.proficiency,
          });
          text = r.data.meaning.trim();
          detail = r.data.simple.trim();
          source = "llm";
        }
        latencyMs = Date.now() - t0;
        await ctx.runMutation(internal.integrations.record, {
          service: "llm",
          operation: `lamb.${args.kind}`,
          status: "success",
          mode: "live",
          latencyMs,
          detail: `${llmModel()} · retrieval ${args.retrievalMode} · ${data.support}`,
        });
      } catch (e) {
        text = "";
        await ctx.runMutation(internal.integrations.record, {
          service: "llm",
          operation: `lamb.${args.kind}`,
          status: "error",
          mode: "live",
          detail: (e as Error).message,
        });
      }
    }

    if (!text) {
      // Rule fallbacks. These are labelled "rules" in the UI — never presented as model output.
      if (args.kind === "spark") {
        const topic = args.topics[0] ?? "the last thing they mentioned";
        text = `I'd love to hear more about ${topic} — what was it like?`;
        detail = "A small follow-up that invites a story.";
      } else if (args.kind === "rescue") {
        text = "Describe it another way: \"It's the thing you use when…\" — your buddy will often say the word for you.";
        detail = "A talking-around-the-word trick, so you keep going instead of stopping.";
      } else {
        // A translation needs a language model; a wrong guess in the student's language is worse
        // than no answer, so the panel keeps its built-in plain-English gloss instead.
        return { skipped: "no-model" };
      }
      await ctx.runMutation(internal.integrations.record, {
        service: "llm",
        operation: `lamb.${args.kind}`,
        status: "fallback",
        mode: "demo",
        detail: llmConfigured() ? "model call failed — rule fallback" : "ANTHROPIC_API_KEY not set — rule fallback",
      });
    }

    const momentId = await ctx.runMutation(internal.lamb.record, {
      conversationId: args.conversationId,
      studentId: userId,
      kind: args.kind,
      trigger: args.trigger,
      text,
      detail: detail || undefined,
      phrase: args.kind === "gloss" ? phrase : rescued,
      source,
      latencyMs,
    });

    return {
      moment: {
        _id: momentId,
        kind: args.kind,
        trigger: args.trigger,
        text,
        detail: detail || undefined,
        phrase: args.kind === "gloss" ? phrase : rescued,
        source,
        latencyMs,
      },
    };
  },
});

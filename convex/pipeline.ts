"use node";
// Consent-aware post-call pipeline:
// audio (Convex storage) → Cartesia Ink transcription → pacing metrics → LLM analysis
// → learning insights (student) + draft Memory Book entry (senior) → Convex → Moss queue.
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { cartesiaConfig, speechMetrics, transcribeWithInk, type InkWord } from "./lib/cartesia";
import { analyzeConversation, llmConfigured, llmModel } from "./lib/llm";
import { heuristicAnalysis } from "./lib/heuristics";

type Segment = { speaker: "student" | "senior"; start: number; end: number; text: string };

function toSegments(words: InkWord[], speaker: Segment["speaker"], offsetSec: number, fallbackText: string, duration: number): Segment[] {
  if (!words.length) return fallbackText.trim() ? [{ speaker, start: offsetSec, end: offsetSec + duration, text: fallbackText.trim() }] : [];
  const out: Segment[] = [];
  let cur: Segment | null = null;
  for (const w of words) {
    const start = offsetSec + w.start;
    const end = offsetSec + w.end;
    if (!cur || start - cur.end > 1.2) {
      if (cur) out.push(cur);
      cur = { speaker, start, end, text: w.word.trim() };
    } else {
      cur.text += ` ${w.word.trim()}`;
      cur.end = end;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export const process = internalAction({
  args: { conversationId: v.id("conversations"), force: v.boolean() },
  handler: async (ctx, { conversationId, force }) => {
    const claimed = await ctx.runMutation(internal.pipelineData.claim, { conversationId, force });
    if (!claimed) return;
    const data = await ctx.runQuery(internal.pipelineData.load, { conversationId });
    if (!data || !data.student || !data.senior) return;
    const { conv, student, senior, studentConsent, seniorConsent } = data;

    const fail = async (error: string) => {
      await ctx.runMutation(internal.pipelineData.setStatus, { conversationId, processing: "failed", error });
    };

    // 1–2. Transcribe each participant's own consented audio with Cartesia Ink.
    if (!cartesiaConfig().configured) {
      await ctx.runMutation(internal.integrations.record, {
        service: "cartesia",
        operation: "ink.transcribe",
        status: "skipped",
        mode: "demo",
        detail: "CARTESIA_API_KEY not set in Convex env — call transcription skipped",
      });
      await ctx.runMutation(internal.pipelineData.deleteAudio, { conversationId });
      return fail("Transcription is unavailable because Cartesia isn't configured on this server. Your call itself was not affected.");
    }

    const segments: Segment[] = [];
    let studentWords: InkWord[] = [];
    let seniorWordCount = 0;
    for (const rec of conv.recordings) {
      const blob = await ctx.storage.get(rec.storageId);
      if (!blob) continue;
      const speaker = rec.userId === conv.studentId ? "student" : "senior";
      try {
        const ext = rec.mimeType.includes("ogg") ? "ogg" : rec.mimeType.includes("mp4") ? "m4a" : "webm";
        const result = await transcribeWithInk(blob, `${speaker}.${ext}`);
        await ctx.runMutation(internal.integrations.record, {
          service: "cartesia",
          operation: "ink.transcribe",
          status: "success",
          mode: "live",
          latencyMs: result.latencyMs,
          detail: `${speaker} track · ${result.duration.toFixed(0)}s audio · ${result.words.length} words`,
        });
        const offset = Math.max(0, (rec.startedAt - conv.startedAt) / 1000);
        segments.push(...toSegments(result.words, speaker, offset, result.text, result.duration));
        if (speaker === "student") studentWords = result.words;
        else seniorWordCount += result.words.length || result.text.split(/\s+/).filter(Boolean).length;
      } catch (e) {
        await ctx.runMutation(internal.integrations.record, {
          service: "cartesia",
          operation: "ink.transcribe",
          status: "error",
          mode: "live",
          detail: (e as Error).message,
        });
      }
    }
    // Raw audio is never kept after transcription.
    await ctx.runMutation(internal.pipelineData.deleteAudio, { conversationId });
    if (!segments.length) return fail("We couldn't hear enough speech in the recording to create notes.");
    segments.sort((a, b) => a.start - b.start);

    const sm = speechMetrics(studentWords);
    const totalWords = sm.words + seniorWordCount;
    const metrics = {
      studentWords: sm.words,
      seniorWords: seniorWordCount,
      studentSpeakingSec: sm.speakingSec,
      studentWpm: sm.wpm,
      studentLongPauses: sm.longPauses,
      studentFillers: sm.fillers,
      studentShare: totalWords ? sm.words / totalWords : 0,
    };

    // 3–5. Analyze with the LLM (or clearly-labeled rule-based demo analysis).
    await ctx.runMutation(internal.pipelineData.setStatus, { conversationId, processing: "analyzing" });
    const transcriptText = segments.map((s) => `${s.speaker === "student" ? student.name : senior.name}: ${s.text}`).join("\n");
    let analysis;
    let analysisSource: "llm" | "heuristic-demo" = "llm";
    if (llmConfigured()) {
      try {
        const { data: result, latencyMs } = await analyzeConversation({
          studentName: student.name,
          seniorName: senior.name,
          proficiency: student.proficiency,
          goals: student.learningGoals ?? [],
          transcript: transcriptText,
          metrics: {
            wpm: metrics.studentWpm,
            longPauses: metrics.studentLongPauses,
            fillers: metrics.studentFillers,
            share: metrics.studentShare,
            durationMin: (conv.durationSec ?? 0) / 60,
          },
        });
        analysis = result;
        await ctx.runMutation(internal.integrations.record, { service: "llm", operation: "analyze.conversation", status: "success", mode: "live", latencyMs, detail: llmModel() });
      } catch (e) {
        await ctx.runMutation(internal.integrations.record, { service: "llm", operation: "analyze.conversation", status: "error", mode: "live", detail: (e as Error).message });
      }
    } else {
      await ctx.runMutation(internal.integrations.record, {
        service: "llm",
        operation: "analyze.conversation",
        status: "fallback",
        mode: "demo",
        detail: "ANTHROPIC_API_KEY not set — rule-based demo analysis used",
      });
    }
    if (!analysis) {
      analysisSource = "heuristic-demo";
      analysis = heuristicAnalysis({
        studentName: student.name,
        seniorName: senior.name,
        studentText: segments.filter((s) => s.speaker === "student").map((s) => s.text).join(" "),
        seniorText: segments.filter((s) => s.speaker === "senior").map((s) => s.text).join(" "),
        metrics: { wpm: metrics.studentWpm, longPauses: metrics.studentLongPauses, fillers: metrics.studentFillers, share: metrics.studentShare },
      });
    }

    // 6–7. Persist with per-person consent: transcripts, learning feedback, memory book, Moss indexing.
    await ctx.runMutation(internal.pipelineData.saveResults, {
      conversationId,
      storeTranscript: Boolean(studentConsent?.storeTranscripts && seniorConsent?.storeTranscripts),
      segments,
      metrics,
      analysisSource,
      analysis,
      saveInsight: studentConsent?.learningFeedback ?? true,
      indexInsight: Boolean(studentConsent?.indexInMoss),
      saveMemory: seniorConsent?.memoryBook ?? true,
    });
    await ctx.runMutation(internal.integrations.record, {
      service: "convex",
      operation: "pipeline.persist",
      status: "success",
      mode: "live",
      detail: `insights + memory saved (${analysisSource})`,
    });
  },
});

import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { cartesiaConfig, speechMetrics, transcribeWithInk } from "../../../../../convex/lib/cartesia";
import { errorResponse, report, userClient } from "@/lib/server/convex";

export const runtime = "nodejs";

// Student's spoken answer → Cartesia Ink (with word timestamps) → Convex action for coaching feedback.
export async function POST(req: Request) {
  try {
    const client = userClient(req);
    const form = await req.formData();
    const sessionId = String(form.get("sessionId")) as Id<"practiceSessions">;
    const typed = form.get("typed");
    const audio = form.get("audio");
    let transcript = "";
    let durationSec = 0;
    let wordCount = 0;
    let sttSource: "cartesia-ink" | "typed" = "typed";
    let ink: { latencyMs: number; words: Array<{ word: string; start: number; end: number }> } | null = null;

    if (audio instanceof Blob && audio.size > 0) {
      if (!cartesiaConfig().configured) {
        report(client, { service: "cartesia", operation: "ink.transcribe", status: "skipped", mode: "demo", detail: "CARTESIA_API_KEY not set" });
        return NextResponse.json({ error: "Cartesia Ink isn't configured, so speech can't be transcribed. Type your answer instead.", needsTyping: true }, { status: 503 });
      }
      try {
        const r = await transcribeWithInk(audio, `answer.${audio.type.includes("ogg") ? "ogg" : audio.type.includes("mp4") ? "m4a" : "webm"}`);
        report(client, { service: "cartesia", operation: "ink.transcribe", status: "success", mode: "live", latencyMs: r.latencyMs, detail: `practice · ${r.duration.toFixed(1)}s · ${r.words.length} words` });
        transcript = r.text;
        const m = speechMetrics(r.words, r.duration);
        // Pace is measured over the span actually spoken (first to last word), not leading/trailing silence.
        const span = r.words.length > 1 ? r.words[r.words.length - 1].end - r.words[0].start : 0;
        durationSec = span > 1 ? span : r.duration || m.speakingSec;
        wordCount = m.words || r.text.split(/\s+/).filter(Boolean).length;
        sttSource = "cartesia-ink";
        ink = { latencyMs: r.latencyMs, words: r.words };
      } catch (e) {
        report(client, { service: "cartesia", operation: "ink.transcribe", status: "error", mode: "live", detail: (e as Error).message });
        return NextResponse.json({ error: "We couldn't transcribe that recording. Please try again." }, { status: 502 });
      }
    } else if (typeof typed === "string" && typed.trim()) {
      transcript = typed.trim();
      wordCount = transcript.split(/\s+/).length;
      durationSec = Number(form.get("durationSec") || 0) || wordCount / 2;
    } else {
      return NextResponse.json({ error: "No answer received." }, { status: 400 });
    }

    const result = await client.action(api.practiceAI.evaluate, { sessionId, transcript, durationSec, wordCount, sttSource });
    return NextResponse.json({ ...result, ink });
  } catch (e) {
    return errorResponse(e);
  }
}

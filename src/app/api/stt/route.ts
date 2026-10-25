import { NextResponse } from "next/server";
import { cartesiaConfig, transcribeWithInk } from "../../../../convex/lib/cartesia";
import { errorResponse, report, userClient } from "@/lib/server/convex";

export const runtime = "nodejs";

// Generic Cartesia Ink transcription (used by the Memory Book's "speak your question" button).
export async function POST(req: Request) {
  try {
    const client = userClient(req);
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || !audio.size) return NextResponse.json({ error: "No audio" }, { status: 400 });
    if (!cartesiaConfig().configured) {
      report(client, { service: "cartesia", operation: "ink.transcribe", status: "skipped", mode: "demo", detail: "CARTESIA_API_KEY not set" });
      return NextResponse.json({ error: "Voice input needs Cartesia to be configured. Please type instead.", needsTyping: true }, { status: 503 });
    }
    const r = await transcribeWithInk(audio, "question.webm");
    report(client, { service: "cartesia", operation: "ink.transcribe", status: "success", mode: "live", latencyMs: r.latencyMs, detail: `voice query · ${r.duration.toFixed(1)}s` });
    return NextResponse.json({ text: r.text });
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse } from "next/server";
import { cartesiaConfig, synthesizeWithSonic } from "../../../../convex/lib/cartesia";
import { errorResponse, report, userClient } from "@/lib/server/convex";

export const runtime = "nodejs";

// Cartesia Sonic text-to-speech for the Practice Studio coach and senior read-aloud.
export async function POST(req: Request) {
  try {
    const client = userClient(req);
    const { text, speed } = (await req.json()) as { text: string; speed?: number };
    if (!text?.trim()) return NextResponse.json({ error: "Nothing to say" }, { status: 400 });
    if (!cartesiaConfig().configured) {
      report(client, { service: "cartesia", operation: "sonic.tts", status: "fallback", mode: "demo", detail: "CARTESIA_API_KEY not set — browser voice used" });
      return NextResponse.json({ fallback: true, reason: "Cartesia Sonic is not configured on this server." }, { status: 503 });
    }
    try {
      const { audio, contentType, latencyMs } = await synthesizeWithSonic(text.slice(0, 1500), { speed: speed ?? 1 });
      report(client, { service: "cartesia", operation: "sonic.tts", status: "success", mode: "live", latencyMs, detail: `${text.length} chars` });
      return new Response(audio, { headers: { "Content-Type": contentType, "Cache-Control": "no-store", "X-Latency-Ms": String(latencyMs) } });
    } catch (e) {
      report(client, { service: "cartesia", operation: "sonic.tts", status: "error", mode: "live", detail: (e as Error).message });
      return NextResponse.json({ error: "Voice synthesis failed", detail: (e as Error).message, fallback: true }, { status: 502 });
    }
  } catch (e) {
    return errorResponse(e);
  }
}

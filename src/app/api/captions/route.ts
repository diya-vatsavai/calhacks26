import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { cartesiaConfig, transcribeWithInk } from "../../../../convex/lib/cartesia";
import { errorResponse, report, userClient } from "@/lib/server/convex";

export const runtime = "nodejs";

/**
 * One spoken segment in, one caption line out.
 *
 * The browser cuts audio on natural pauses (see VAD in src/lib/lamb.ts) and posts each segment
 * here: Cartesia Ink transcribes it, Convex stores it (which enforces that both people consented
 * and gives the Lamb a live transcript to reason over). Short/failed segments are dropped rather
 * than shown, so a cough never becomes a caption.
 */
export async function POST(req: Request) {
  try {
    const client = userClient(req);
    const form = await req.formData();
    const audio = form.get("audio");
    const conversationId = String(form.get("conversationId") ?? "");
    const speaker = String(form.get("speaker") ?? "self") === "buddy" ? "buddy" : "self";
    const durationSec = Number(form.get("durationSec") ?? 0);
    if (!conversationId) return NextResponse.json({ error: "Missing call" }, { status: 400 });
    if (!(audio instanceof Blob) || audio.size < 1_200) return NextResponse.json({ text: "" });

    if (!cartesiaConfig().configured) {
      report(client, { service: "cartesia", operation: "ink.caption", status: "skipped", mode: "demo", detail: "CARTESIA_API_KEY not set" });
      return NextResponse.json({ text: "", unavailable: true });
    }

    const t0 = Date.now();
    const r = await transcribeWithInk(audio, "caption.webm");
    const text = r.text.trim().replace(/\s+/g, " ").slice(0, 500);
    if (text) {
      await client.mutation(api.lamb.addCaption, {
        conversationId: conversationId as Id<"conversations">,
        speaker,
        text,
        latencyMs: r.latencyMs,
        durationSec: Number.isFinite(durationSec) ? durationSec : 0,
      });
    }
    report(client, {
      service: "cartesia",
      operation: "ink.caption",
      status: "success",
      mode: "live",
      latencyMs: r.latencyMs,
      detail: `${text.length} chars · segment ${(Date.now() - t0) / 1000}s round trip`,
    });
    return NextResponse.json({ text, latencyMs: r.latencyMs });
  } catch (e) {
    return errorResponse(e);
  }
}

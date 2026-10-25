import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import { cartesiaConfig } from "../../../../convex/lib/cartesia";
import { errorResponse, userClient } from "@/lib/server/convex";
import { listIndexes, mossConfigured } from "@/lib/server/moss";
import { KINDRED_INDEX } from "@/lib/server/sync";

export const runtime = "nodejs";

// Configuration status for the admin integration monitor. Booleans and model names only — never keys.
export async function GET(req: Request) {
  try {
    const client = userClient(req);
    const viewer = await client.query(api.users.viewer, {});
    if (viewer?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
    const c = cartesiaConfig();
    let indexes = null;
    let mossError: string | null = null;
    if (mossConfigured()) {
      try {
        // Only Kindred's own index is shown — other indexes in the Moss project are not ours to display.
        indexes = (await listIndexes())?.filter((i) => i.name === KINDRED_INDEX) ?? null;
      } catch (e) {
        mossError = (e as Error).message.slice(0, 200);
      }
    }
    return NextResponse.json({
      convex: { url: process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/^https?:\/\//, "") ?? null },
      cartesia: { configured: c.configured, ttsModel: c.ttsModel, sttModel: c.sttModel, apiVersion: c.version, note: "Convex actions read CARTESIA_API_KEY from the Convex deployment env" },
      moss: { configured: mossConfigured(), model: process.env.MOSS_MODEL_ID || "moss-minilm", indexes, error: mossError },
      llm: { configuredInNext: Boolean(process.env.ANTHROPIC_API_KEY), model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5", note: "LLM runs in Convex actions (Convex env)" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

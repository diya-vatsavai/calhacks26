import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { errorResponse, userClient } from "@/lib/server/convex";
import { searchOwn, syncViewer } from "@/lib/server/sync";

export const runtime = "nodejs";

// Moss-powered natural-language search over the senior's OWN approved memories.
// Calibrated on Moss moss-minilm scores: related ≈ 0.3+, unrelated ≈ 0.1.
const MIN_SCORE = { moss: 0.2, fallback: 0.12 };

export async function POST(req: Request) {
  try {
    const client = userClient(req);
    const { query, buddyId } = (await req.json()) as { query: string; buddyId?: string };
    if (!query?.trim()) return NextResponse.json({ results: [], mode: "none" });
    await syncViewer(client).catch(() => {});
    const res = await searchOwn(client, query, 6, buddyId ? { buddyId } : undefined);
    const relevant = res.hits.filter((h) => h.score >= MIN_SCORE[res.mode]);
    // Resolve ids through Convex, which re-checks ownership and approval.
    const entries = await client.query(api.memories.getMany, { ids: relevant.map((h) => h.id) });
    const results = relevant
      .map((h) => ({ score: h.score, entry: entries.find((e) => e._id === h.id) }))
      .filter((r) => r.entry);
    return NextResponse.json({ results, mode: res.mode, latencyMs: res.latencyMs });
  } catch (e) {
    return errorResponse(e);
  }
}

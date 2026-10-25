import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { errorResponse, userClient } from "@/lib/server/convex";
import { mossConfigured } from "@/lib/server/moss";
import { searchOwn } from "@/lib/server/sync";

export const runtime = "nodejs";

type Body = {
  conversationId: string;
  kind: "spark" | "rescue" | "gloss";
  trigger: "asked" | "hesitation" | "lull" | "rare_phrase";
  phrase?: string;
  stall?: string;
};

/**
 * The Lamb's one door.
 *
 * Retrieval happens here because the Moss index lives in this long-running Node process; the
 * reasoning happens in the Convex action, which owns consent, the proactivity budget and the API
 * key. Context is derived from the caller's own session, never from the request body, so a tab
 * cannot ask the Lamb to speak for someone else or to invent a topic that isn't theirs.
 */
export async function POST(req: Request) {
  try {
    const client = userClient(req);
    const body = (await req.json()) as Body;
    const viewer = await client.query(api.users.viewer, {});
    if (!viewer || viewer.role !== "student") {
      return NextResponse.json({ error: "The Lamb is for students." }, { status: 403 });
    }
    const conversationId = body.conversationId as Id<"conversations">;
    const session = await client.query(api.lamb.session, { conversationId });
    if (!session?.isStudent) return NextResponse.json({ error: "That call isn't available." }, { status: 403 });

    // Ground the answer in the student's OWN history — their past calls with this buddy, their
    // weaknesses, the buddy's stories. Best effort: a retrieval failure never blocks the Lamb.
    let retrieved: Array<{ text: string; score: number; source: string }> = [];
    let retrievalMode: "moss" | "fallback" | "none" = "none";
    const query =
      body.kind === "spark"
        ? `stories and favourite topics from conversations with ${session.buddy.name}. ${session.topics.join(", ")}`
        : body.kind === "gloss"
          ? body.phrase ?? ""
          : body.stall ?? "";
    if (query.trim()) {
      try {
        const res = await searchOwn(client, query, 3);
        retrieved = res.hits.map((h) => ({
          text: h.text.slice(0, 400),
          score: h.score,
          source: h.metadata?.kind === "memory" ? "Memory Book" : "Learning history",
        }));
        retrievalMode = res.mode;
      } catch {
        retrievalMode = "none";
      }
    }

    const answer = await client.action(api.lambAI.assist, {
      conversationId,
      kind: body.kind,
      trigger: body.trigger,
      phrase: body.phrase?.slice(0, 200),
      stall: body.stall?.slice(0, 400),
      topics: session.topics,
      focus: session.focus,
      retrieved,
      retrievalMode,
    });
    return NextResponse.json({ ...answer, retrievalMode, retrievalCount: retrieved.length, moss: mossConfigured() });
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { errorResponse, userClient } from "@/lib/server/convex";
import { searchOwn, syncViewer } from "@/lib/server/sync";

export const runtime = "nodejs";

// 1) Moss retrieves the student's most relevant past weaknesses, 2) a Convex action asks the LLM
// to build a personalized exercise from them, 3) Convex stores the exercise + session.
export async function POST(req: Request) {
  try {
    const client = userClient(req);
    const { type, focus } = (await req.json().catch(() => ({}))) as { type?: string; focus?: string };
    const viewer = await client.query(api.users.viewer, {});
    if (viewer?.role !== "student" || !viewer.profile) return NextResponse.json({ error: "Students only" }, { status: 403 });
    await syncViewer(client).catch(() => {});
    const goals = viewer.profile.learningGoals ?? [];
    const queryText =
      focus ||
      `mistakes and weaknesses to practice: ${goals.join(", ")}${type ? `, ${type}` : ""}; grammar errors, vocabulary, fluency while talking about ${viewer.interests.slice(0, 2).join(" and ")}`;
    const res = await searchOwn(client, queryText, 4);
    const retrieved = res.hits.map((h) => ({ text: h.text, score: Math.round(h.score * 1000) / 1000, source: `${h.metadata.buddyName ? `Call with ${h.metadata.buddyName}` : "Learning history"} · ${h.metadata.date ?? ""}` }));
    const ids = await client.action(api.practiceAI.generate, {
      requestedType: type as never,
      retrieved,
      retrievalMode: retrieved.length ? res.mode : "none",
    });
    return NextResponse.json({ ...ids, retrieval: { mode: res.mode, latencyMs: res.latencyMs, count: retrieved.length } });
  } catch (e) {
    return errorResponse(e);
  }
}

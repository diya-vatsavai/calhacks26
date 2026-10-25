import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import { errorResponse, userClient } from "@/lib/server/convex";
import { searchOwn } from "@/lib/server/sync";

export const runtime = "nodejs";

/** "More about Gardening." → "gardening"; keeps proper nouns ("Big Sur", "Eleanor's rose") intact. */
function topicPhrase(t: string) {
  const s = t.trim().replace(/^(more )?about /i, "").replace(/[.?!]+$/, "");
  const [w, ...rest] = s.split(" ");
  const keepCase = /^[A-Z][a-z]+'s$/.test(w) || /^[A-Z]{2,}/.test(w) || ["I", "California", "Highway"].includes(w);
  return [keepCase ? w : w.toLowerCase(), ...rest].join(" ");
}

// Conversation starters when buddies reconnect — retrieved from the viewer's own history via Moss.
export async function POST(req: Request) {
  try {
    const client = userClient(req);
    const { relationshipId } = (await req.json()) as { relationshipId: string };
    const viewer = await client.query(api.users.viewer, {});
    const buddies = await client.query(api.matching.myBuddies, {});
    const b = buddies.find((x) => x.relationshipId === relationshipId);
    if (!viewer || !b) return NextResponse.json({ starters: [] });
    const first = b.buddy.name.split(" ")[0];
    const starters: Array<{ text: string; source: string }> = [];
    let mode: string = "none";
    if (viewer.role === "senior") {
      const res = await searchOwn(client, `stories and favorite topics with ${b.buddy.name}`, 3, { buddyId: b.buddy.userId });
      mode = res.mode;
      const entries = await client.query(api.memories.getMany, { ids: res.hits.map((h) => h.id) });
      for (const e of entries.slice(0, 2)) {
        const next = e.nextTopics[0];
        starters.push({
          text: `Last time, you and ${first} talked about ${topicPhrase(e.topics[0] ?? e.title)}.${next ? ` Next time, you could talk about ${topicPhrase(next)}.` : ""}`,
          source: "Memory Book",
        });
      }
    } else if (viewer.role === "student") {
      const res = await searchOwn(client, `conversation with ${b.buddy.name}`, 3, { buddyName: b.buddy.name });
      mode = res.mode;
      for (const h of res.hits.slice(0, 1)) {
        const topics = h.text.match(/about ([^.]+)\./)?.[1];
        if (topics) starters.push({ text: `Last time you and ${first} talked about ${topics}.`, source: "Learning history" });
      }
    }
    for (const t of b.nextTopics.slice(0, 2)) {
      const phrase = topicPhrase(t);
      if (!starters.some((s) => s.text.includes(phrase))) starters.push({ text: `Talk with ${first} about ${phrase}.`, source: "Suggested from your last call" });
    }
    if (!starters.length)
      for (const i of b.sharedInterests.slice(0, 2)) starters.push({ text: `You both enjoy ${i}. What got ${first} interested in it?`, source: "Shared interest" });
    return NextResponse.json({ starters: starters.slice(0, 3), mode });
  } catch (e) {
    return errorResponse(e);
  }
}

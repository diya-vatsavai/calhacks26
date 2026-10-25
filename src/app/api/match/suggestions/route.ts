import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { fallbackSimilarity } from "../../../../../convex/lib/concepts";
import { errorResponse, report, userClient } from "@/lib/server/convex";
import { mossConfigured } from "@/lib/server/moss";
import { searchProfiles, syncProfiles } from "@/lib/server/sync";

export const runtime = "nodejs";

const WEIGHTS = { semantic: 0.5, availability: 0.25, preferences: 0.15, pace: 0.1 };

/**
 * Explainable compatibility score:
 *   50% Moss semantic interest similarity (e.g. "growing roses" ≈ "gardening and house plants")
 *   25% timezone-aware weekly availability overlap (Convex)
 *   15% favorite-topic overlap (Convex)
 *   10% conversation pace fit (Convex)
 */
export async function POST(req: Request) {
  try {
    const client = userClient(req);
    const { me, candidates } = await client.query(api.matching.candidates, {});
    if (!me.interests.length) return NextResponse.json({ suggestions: [], mode: "none" });

    const live = mossConfigured();
    if (live) await syncProfiles(client);

    // pairSim[candidateId][myInterest] = { theirs, similarity }
    const pairSim = new Map<string, Map<string, { theirs: string; similarity: number }>>();
    const put = (cid: string, mine: string, theirs: string, similarity: number) => {
      const m = pairSim.get(cid) ?? new Map();
      if ((m.get(mine)?.similarity ?? -1) < similarity) m.set(mine, { theirs, similarity });
      pairSim.set(cid, m);
    };
    const otherRole = me.role === "student" ? "senior" : "student";
    let latency = 0;
    if (live) {
      for (const interest of me.interests) {
        const res = await searchProfiles(interest, otherRole);
        latency += res.latencyMs;
        for (const h of res.hits) put(h.metadata.userId, interest, h.metadata.label ?? h.text, Math.max(0, Math.min(1, h.score)));
      }
      report(client, { service: "moss", operation: "matching.semantic", status: "success", mode: "live", latencyMs: latency, detail: `${me.interests.length} interest queries` });
    } else {
      for (const c of candidates)
        for (const mine of me.interests)
          for (const theirs of c.interests) put(c.profile.userId, mine, theirs, fallbackSimilarity(mine, theirs));
      report(client, { service: "moss", operation: "matching.semantic", status: "fallback", mode: "demo", detail: "Moss not configured — concept-lexicon similarity" });
    }

    const suggestions = candidates.map((c) => {
      const pairs = [...(pairSim.get(c.profile.userId)?.entries() ?? [])]
        .map(([mine, v]) => ({ mine, theirs: v.theirs, similarity: Math.round(v.similarity * 100) / 100 }))
        .sort((a, b) => b.similarity - a.similarity);
      const top = pairs.slice(0, 2);
      // Moss similarities for short phrases run ~0.1 (unrelated) to ~0.5 (very close); rescale to 0–1
      // for the weighted score. Raw similarities are still shown in explanations.
      const scale = (x: number) => (live ? Math.max(0, Math.min(1, (x - 0.1) / 0.4)) : x);
      const semanticScore = top.length ? top.reduce((n, p) => n + scale(p.similarity), 0) / top.length : 0;
      const score =
        WEIGHTS.semantic * semanticScore +
        WEIGHTS.availability * c.availabilityScore +
        WEIGHTS.preferences * c.preferenceScore +
        WEIGHTS.pace * c.goalScore;
      const first = c.profile.name.split(" ")[0];
      const myFirst = me.name.split(" ")[0];
      const strong = pairs.filter((p) => p.similarity >= (live ? 0.28 : 0.3)).slice(0, 2);
      const parts = [];
      if (strong.length)
        parts.push(
          strong.map((p) => `${myFirst}'s “${p.mine}” connects with ${first}'s “${p.theirs}”`).join(", and ") + ".",
        );
      if (c.overlapMinutes > 0) parts.push(`You share about ${Math.round(c.overlapMinutes / 60)} hours of free time each week, across time zones.`);
      else parts.push("Your weekly availability doesn't overlap yet — you can still agree on a time.");
      if (c.preferenceScore > 0.3) parts.push("You like talking about similar topics.");
      return {
        candidateId: c.profile.userId as Id<"users">,
        score: Math.round(score * 1000) / 1000,
        semanticScore: Math.round(semanticScore * 1000) / 1000,
        availabilityScore: Math.round(c.availabilityScore * 1000) / 1000,
        preferenceScore: Math.round(c.preferenceScore * 1000) / 1000,
        goalScore: Math.round(c.goalScore * 1000) / 1000,
        sharedPairs: strong.length ? strong : pairs.slice(0, 1),
        explanation: parts.join(" "),
      };
    });
    suggestions.sort((a, b) => b.score - a.score);
    const mode = live ? "moss" : "fallback";
    await client.mutation(api.matching.saveSuggestions, { suggestions: suggestions.slice(0, 12), retrievalMode: mode });
    return NextResponse.json({ count: suggestions.length, mode, latencyMs: latency });
  } catch (e) {
    return errorResponse(e);
  }
}

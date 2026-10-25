import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getProfile, publicProfile, requireProfile, requireServerSecret, requireUser } from "./lib/authz";
import { overlapMinutes, type Slot } from "./lib/time";
import { topicOverlap } from "./lib/concepts";
import { logEvent } from "./integrations";

async function interestLabels(ctx: QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db.query("interests").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  return rows.filter((r) => r.kind === "interest").map((r) => r.label);
}

async function availabilityOf(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db.query("availability").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
}

async function blockedIds(ctx: QueryCtx, userId: Id<"users">) {
  const mine = await ctx.db.query("safetyReports").withIndex("by_reporter", (q) => q.eq("reporterId", userId)).collect();
  const ids = new Set<string>(mine.filter((r) => r.kind === "block").map((r) => r.reportedId));
  // Also respect blocks made against the viewer.
  const all = await ctx.db.query("safetyReports").withIndex("by_status").collect();
  for (const r of all) if (r.kind === "block" && r.reportedId === userId) ids.add(r.reporterId);
  return ids;
}

async function relationshipFor(ctx: QueryCtx, a: Doc<"profiles">, bId: Id<"users">) {
  const studentId = a.role === "student" ? a.userId : bId;
  const seniorId = a.role === "student" ? bId : a.userId;
  const rels = await ctx.db.query("buddyRelationships").withIndex("by_student", (q) => q.eq("studentId", studentId)).collect();
  return rels.find((r) => r.seniorId === seniorId) ?? null;
}

/**
 * Deterministic matching factors computed in Convex: availability overlap (timezone-aware),
 * topic/preference overlap, and conversation pace fit. Semantic interest similarity comes from
 * Moss and is combined by the Next.js matching service, then saved with `saveSuggestions`.
 */
export const candidates = query({
  args: {},
  handler: async (ctx) => {
    const { profile: me } = await requireProfile(ctx);
    if (me.role === "admin") throw new ConvexError("Admins don't receive matches.");
    const otherRole = me.role === "student" ? "senior" : "student";
    const myInterests = await interestLabels(ctx, me.userId);
    const myAvail = await availabilityOf(ctx, me.userId);
    const blocked = await blockedIds(ctx, me.userId);
    const others = await ctx.db.query("profiles").withIndex("by_role", (q) => q.eq("role", otherRole)).collect();
    const out = [];
    for (const p of others) {
      if (blocked.has(p.userId)) continue;
      const rel = await relationshipFor(ctx, me, p.userId);
      if (rel && rel.status !== "ended") continue; // existing buddies live in "My buddies"
      const theirAvail = await availabilityOf(ctx, p.userId);
      const overlap =
        myAvail && theirAvail ? overlapMinutes(myAvail.slots as Slot[], myAvail.timezone, theirAvail.slots as Slot[], theirAvail.timezone) : 0;
      const availabilityScore = Math.min(1, overlap / 180);
      const preferenceScore = topicOverlap(me.topics, p.topics);
      const student = me.role === "student" ? me : p;
      const senior = me.role === "student" ? p : me;
      const paceFit =
        student.proficiency === "beginner"
          ? senior.accessibility?.slowerSpeech
            ? 1
            : 0.6
          : student.proficiency === "advanced"
            ? 0.9
            : 0.8;
      out.push({
        profile: publicProfile(p),
        interests: await interestLabels(ctx, p.userId),
        overlapMinutes: overlap,
        availabilityScore,
        preferenceScore,
        goalScore: paceFit,
      });
    }
    return { me: { ...publicProfile(me), interests: myInterests }, candidates: out };
  },
});

export const saveSuggestions = mutation({
  args: {
    retrievalMode: v.union(v.literal("moss"), v.literal("fallback")),
    suggestions: v.array(
      v.object({
        candidateId: v.id("users"),
        score: v.number(),
        semanticScore: v.number(),
        availabilityScore: v.number(),
        preferenceScore: v.number(),
        goalScore: v.number(),
        sharedPairs: v.array(v.object({ mine: v.string(), theirs: v.string(), similarity: v.number() })),
        explanation: v.string(),
      }),
    ),
  },
  handler: async (ctx, { suggestions, retrievalMode }) => {
    const user = await requireUser(ctx);
    const t0 = Date.now();
    for (const old of await ctx.db.query("matchSuggestions").withIndex("by_user", (q) => q.eq("forUserId", user._id)).collect()) {
      await ctx.db.delete(old._id);
    }
    for (const s of suggestions) {
      const cand = await getProfile(ctx, s.candidateId);
      if (!cand) continue;
      await ctx.db.insert("matchSuggestions", { ...s, forUserId: user._id, retrievalMode, computedAt: Date.now() });
    }
    await logEvent(ctx, {
      service: "convex",
      operation: "matching.saveSuggestions",
      status: "success",
      mode: "live",
      latencyMs: Date.now() - t0,
      detail: `${suggestions.length} suggestions (${retrievalMode})`,
    });
  },
});

export const mySuggestions = query({
  args: {},
  handler: async (ctx) => {
    const { user, profile: me } = await requireProfile(ctx);
    const rows = await ctx.db.query("matchSuggestions").withIndex("by_user", (q) => q.eq("forUserId", user._id)).collect();
    const sent = await ctx.db.query("matchRequests").withIndex("by_from", (q) => q.eq("fromUserId", user._id)).collect();
    const received = await ctx.db.query("matchRequests").withIndex("by_to", (q) => q.eq("toUserId", user._id)).collect();
    const out = [];
    for (const s of rows.sort((a, b) => b.score - a.score)) {
      const p = await getProfile(ctx, s.candidateId);
      if (!p) continue;
      const rel = await relationshipFor(ctx, me, s.candidateId);
      if (rel && rel.status !== "ended") continue;
      const outgoing = sent.find((r) => r.toUserId === s.candidateId && r.status === "pending");
      const incoming = received.find((r) => r.fromUserId === s.candidateId && r.status === "pending");
      out.push({
        ...s,
        profile: publicProfile(p),
        interests: await interestLabels(ctx, p.userId),
        requestState: outgoing ? "sent" : incoming ? "received" : "none",
        requestId: outgoing?._id ?? incoming?._id ?? null,
      });
    }
    return out;
  },
});

export const sendRequest = mutation({
  args: { toUserId: v.id("users"), message: v.optional(v.string()) },
  handler: async (ctx, { toUserId, message }) => {
    const { user, profile: me } = await requireProfile(ctx);
    const them = await getProfile(ctx, toUserId);
    if (!them || them.role === me.role || them.role === "admin") throw new ConvexError("You can only connect students with seniors.");
    const blocked = await blockedIds(ctx, user._id);
    if (blocked.has(toUserId)) throw new ConvexError("This connection isn't available.");
    const existing = await ctx.db.query("matchRequests").withIndex("by_from", (q) => q.eq("fromUserId", user._id).eq("status", "pending")).collect();
    if (existing.some((r) => r.toUserId === toUserId)) return;
    // If they already asked us, sending a request back is a mutual acceptance.
    const theirs = await ctx.db.query("matchRequests").withIndex("by_to", (q) => q.eq("toUserId", user._id).eq("status", "pending")).collect();
    const reverse = theirs.find((r) => r.fromUserId === toUserId);
    const suggestion = await ctx.db.query("matchSuggestions").withIndex("by_pair", (q) => q.eq("forUserId", user._id).eq("candidateId", toUserId)).unique();
    if (reverse) {
      await acceptInternal(ctx, reverse._id, user._id);
      return;
    }
    await ctx.db.insert("matchRequests", {
      fromUserId: user._id,
      toUserId,
      status: "pending",
      message,
      score: suggestion?.score,
      explanation: suggestion?.explanation,
      createdAt: Date.now(),
    });
  },
});

async function acceptInternal(ctx: any, requestId: Id<"matchRequests">, acceptorId: Id<"users">) {
  const req: Doc<"matchRequests"> | null = await ctx.db.get(requestId);
  if (!req || req.toUserId !== acceptorId || req.status !== "pending") throw new ConvexError("That request is no longer pending.");
  await ctx.db.patch(requestId, { status: "accepted", respondedAt: Date.now() });
  const a = await getProfile(ctx, req.fromUserId);
  const b = await getProfile(ctx, req.toUserId);
  if (!a || !b) throw new ConvexError("Profile missing.");
  const student = a.role === "student" ? a : b;
  const senior = a.role === "student" ? b : a;
  const sugg =
    (await ctx.db.query("matchSuggestions").withIndex("by_pair", (q: any) => q.eq("forUserId", student.userId).eq("candidateId", senior.userId)).unique()) ??
    (await ctx.db.query("matchSuggestions").withIndex("by_pair", (q: any) => q.eq("forUserId", senior.userId).eq("candidateId", student.userId)).unique());
  const rels = await ctx.db.query("buddyRelationships").withIndex("by_student", (q: any) => q.eq("studentId", student.userId)).collect();
  const prior = rels.find((r: Doc<"buddyRelationships">) => r.seniorId === senior.userId);
  const shared = sugg ? [...new Set<string>(sugg.sharedPairs.map((p: { theirs: string; mine: string }) => p.mine))].slice(0, 5) : [];
  if (prior) await ctx.db.patch(prior._id, { status: "active" });
  else
    await ctx.db.insert("buddyRelationships", {
      studentId: student.userId,
      seniorId: senior.userId,
      status: "active",
      favoriteOfStudent: false,
      favoriteOfSenior: false,
      score: req.score ?? sugg?.score,
      explanation: req.explanation ?? sugg?.explanation,
      sharedInterests: shared,
      createdAt: Date.now(),
      callsCompleted: 0,
    });
  await logEvent(ctx, { service: "convex", operation: "match.accepted", status: "success", mode: "live", detail: "mutual match stored" });
}

export const respondRequest = mutation({
  args: { requestId: v.id("matchRequests"), accept: v.boolean() },
  handler: async (ctx, { requestId, accept }) => {
    const user = await requireUser(ctx);
    if (accept) return acceptInternal(ctx, requestId, user._id);
    const req = await ctx.db.get(requestId);
    if (!req || req.toUserId !== user._id) throw new ConvexError("Request not found.");
    await ctx.db.patch(requestId, { status: "declined", respondedAt: Date.now() });
  },
});

export const withdrawRequest = mutation({
  args: { requestId: v.id("matchRequests") },
  handler: async (ctx, { requestId }) => {
    const user = await requireUser(ctx);
    const req = await ctx.db.get(requestId);
    if (!req || req.fromUserId !== user._id) throw new ConvexError("Request not found.");
    await ctx.db.patch(requestId, { status: "withdrawn" });
  },
});

export const incomingRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const reqs = await ctx.db.query("matchRequests").withIndex("by_to", (q) => q.eq("toUserId", user._id).eq("status", "pending")).collect();
    const out = [];
    for (const r of reqs) {
      const p = await getProfile(ctx, r.fromUserId);
      if (p) out.push({ ...r, profile: publicProfile(p), interests: await interestLabels(ctx, p.userId) });
    }
    return out;
  },
});

export const myBuddies = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rels =
      user.role === "student"
        ? await ctx.db.query("buddyRelationships").withIndex("by_student", (q) => q.eq("studentId", user._id)).collect()
        : await ctx.db.query("buddyRelationships").withIndex("by_senior", (q) => q.eq("seniorId", user._id)).collect();
    const out = [];
    for (const r of rels.filter((r) => r.status === "active")) {
      const buddyId = r.studentId === user._id ? r.seniorId : r.studentId;
      const p = await getProfile(ctx, buddyId);
      if (!p) continue;
      const calls = await ctx.db.query("scheduledCalls").withIndex("by_relationship", (q) => q.eq("relationshipId", r._id)).collect();
      const now = Date.now();
      const next = calls
        .filter((c) => (c.status === "confirmed" || c.status === "proposed" || c.status === "in_progress") && c.startAt + c.durationMin * 60000 > now)
        .sort((a, b) => a.startAt - b.startAt)[0];
      const convs = await ctx.db.query("conversations").withIndex("by_relationship", (q) => q.eq("relationshipId", r._id)).order("desc").take(1);
      out.push({
        relationshipId: r._id,
        buddy: publicProfile(p),
        interests: await interestLabels(ctx, p.userId),
        favorite: user.role === "student" ? r.favoriteOfStudent : r.favoriteOfSenior,
        sharedInterests: r.sharedInterests,
        score: r.score,
        explanation: r.explanation,
        callsCompleted: r.callsCompleted,
        lastCallAt: r.lastCallAt,
        since: r.createdAt,
        nextCall: next ?? null,
        lastTopics: convs[0]?.sharedTopics ?? [],
        nextTopics: convs[0]?.nextTopics ?? [],
      });
    }
    return out.sort((a, b) => Number(b.favorite) - Number(a.favorite) || (b.lastCallAt ?? 0) - (a.lastCallAt ?? 0));
  },
});

export const toggleFavorite = mutation({
  args: { relationshipId: v.id("buddyRelationships") },
  handler: async (ctx, { relationshipId }) => {
    const user = await requireUser(ctx);
    const r = await ctx.db.get(relationshipId);
    if (!r) throw new ConvexError("Not found");
    if (r.studentId === user._id) await ctx.db.patch(r._id, { favoriteOfStudent: !r.favoriteOfStudent });
    else if (r.seniorId === user._id) await ctx.db.patch(r._id, { favoriteOfSenior: !r.favoriteOfSenior });
    else throw new ConvexError("Not found");
  },
});

export const blockOrReport = mutation({
  args: { userId: v.id("users"), kind: v.union(v.literal("block"), v.literal("report")), reason: v.string() },
  handler: async (ctx, { userId, kind, reason }) => {
    const user = await requireUser(ctx);
    if (userId === user._id) throw new ConvexError("You can't report yourself.");
    await ctx.db.insert("safetyReports", { reporterId: user._id, reportedId: userId, kind, reason: reason.slice(0, 500), createdAt: Date.now(), status: "open" });
    if (kind === "block") {
      const me = await getProfile(ctx, user._id);
      if (me) {
        const rel = await relationshipFor(ctx, me, userId);
        if (rel) await ctx.db.patch(rel._id, { status: "blocked" });
        // Cancel upcoming calls with the blocked person.
        if (rel) {
          for (const c of await ctx.db.query("scheduledCalls").withIndex("by_relationship", (q) => q.eq("relationshipId", rel._id)).collect()) {
            if (c.status === "proposed" || c.status === "confirmed") await ctx.db.patch(c._id, { status: "cancelled" });
          }
        }
      }
    }
  },
});

// ---- Moss indexing support (server-to-server; documents contain only public interest labels) ----

export const profilesForIndex = query({
  args: { secret: v.string(), all: v.optional(v.boolean()) },
  handler: async (ctx, { secret, all }) => {
    requireServerSecret(secret);
    const rows = all
      ? await ctx.db.query("profiles").collect()
      : await ctx.db.query("profiles").withIndex("by_moss_status", (q) => q.eq("mossStatus", "pending")).collect();
    const out = [];
    for (const p of rows) {
      if (p.role === "admin") continue;
      out.push({ userId: p.userId, role: p.role, interests: await interestLabels(ctx, p.userId), oldDocIds: p.mossDocIds ?? [] });
    }
    return out;
  },
});

export const markProfilesIndexed = mutation({
  args: { secret: v.string(), items: v.array(v.object({ userId: v.id("users"), docIds: v.array(v.string()) })) },
  handler: async (ctx, { secret, items }) => {
    requireServerSecret(secret);
    for (const it of items) {
      const p = await getProfile(ctx, it.userId);
      if (p) await ctx.db.patch(p._id, { mossStatus: "indexed", mossDocIds: it.docIds, mossIndexedAt: Date.now() });
    }
  },
});

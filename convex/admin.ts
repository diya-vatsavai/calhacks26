// Administrator views: aggregate, operational data only. Admins never see transcripts,
// learning feedback or memory content — only counts, statuses and matching factors.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/authz";

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");
    const profiles = await ctx.db.query("profiles").collect();
    const users = await ctx.db.query("users").collect();
    const rels = await ctx.db.query("buddyRelationships").collect();
    const requests = await ctx.db.query("matchRequests").collect();
    const calls = await ctx.db.query("scheduledCalls").collect();
    const convs = await ctx.db.query("conversations").collect();
    const suggestions = await ctx.db.query("matchSuggestions").collect();
    const reports = await ctx.db.query("safetyReports").withIndex("by_status", (q) => q.eq("status", "open")).collect();

    const active = rels.filter((r) => r.status === "active");
    const completed = convs.filter((c) => c.endedAt);
    const matchedIds = new Set(active.flatMap((r) => [r.studentId, r.seniorId]));
    const now = Date.now();
    const registered = users.filter((u) => u.role === "student" || u.role === "senior");
    const suggestedFor = new Set(suggestions.map((s) => s.forUserId));
    const firstCall = active.filter((r) => r.callsCompleted >= 1).length;
    const recurring = active.filter((r) => r.callsCompleted >= 3).length;

    return {
      totals: {
        students: profiles.filter((p) => p.role === "student").length,
        seniors: profiles.filter((p) => p.role === "senior").length,
        activePairs: active.length,
        pendingRequests: requests.filter((r) => r.status === "pending").length,
        scheduledCalls: calls.filter((c) => (c.status === "confirmed" || c.status === "proposed") && c.startAt > now).length,
        completedConversations: completed.length,
        recurringFriendships: recurring,
        avgCallMin: completed.length ? Math.round(completed.reduce((n, c) => n + (c.durationSec ?? 0), 0) / completed.length / 60) : 0,
        unmatched: profiles.filter((p) => p.role !== "admin" && !matchedIds.has(p.userId)).length,
        openReports: reports.length,
        aiProcessed: convs.filter((c) => c.processing === "complete").length,
        consentedCalls: convs.filter((c) => c.studentConsent && c.seniorConsent).length,
      },
      funnel: [
        { stage: "Onboarded", count: registered.length },
        { stage: "Profile complete", count: profiles.filter((p) => p.role !== "admin").length },
        { stage: "Match suggested", count: profiles.filter((p) => suggestedFor.has(p.userId) || matchedIds.has(p.userId)).length },
        { stage: "Accepted", count: matchedIds.size },
        { stage: "First call", count: new Set(active.filter((r) => r.callsCompleted >= 1).flatMap((r) => [r.studentId, r.seniorId])).size },
        { stage: "Recurring friendship", count: new Set(active.filter((r) => r.callsCompleted >= 3).flatMap((r) => [r.studentId, r.seniorId])).size },
      ],
      pairStages: { accepted: active.length, firstCall, recurring },
    };
  },
});

export const workspace = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");
    const profiles = await ctx.db.query("profiles").collect();
    const byId = new Map(profiles.map((p) => [p.userId as string, p]));
    const name = (id: string) => byId.get(id)?.name ?? "Unknown";
    const avatar = (id: string) => ({ avatar: byId.get(id)?.avatar ?? "🙂", color: byId.get(id)?.avatarColor ?? "#ddd" });
    const rels = await ctx.db.query("buddyRelationships").collect();
    const requests = await ctx.db.query("matchRequests").withIndex("by_status", (q) => q.eq("status", "pending")).collect();
    const suggestions = await ctx.db.query("matchSuggestions").collect();
    const matched = new Set(rels.filter((r) => r.status === "active").flatMap((r) => [r.studentId as string, r.seniorId as string]));

    return {
      pairs: rels.map((r) => ({
        id: r._id,
        student: { id: r.studentId, name: name(r.studentId), ...avatar(r.studentId) },
        senior: { id: r.seniorId, name: name(r.seniorId), ...avatar(r.seniorId) },
        status: r.status,
        stage: r.status !== "active" ? r.status : r.callsCompleted >= 3 ? "Recurring friendship" : r.callsCompleted >= 1 ? "First call" : "Accepted",
        score: r.score ?? null,
        explanation: r.explanation ?? null,
        sharedInterests: r.sharedInterests,
        callsCompleted: r.callsCompleted,
        lastCallAt: r.lastCallAt ?? null,
      })),
      pending: requests.map((r) => ({
        id: r._id,
        from: { name: name(r.fromUserId), role: byId.get(r.fromUserId)?.role, ...avatar(r.fromUserId) },
        to: { name: name(r.toUserId), role: byId.get(r.toUserId)?.role, ...avatar(r.toUserId) },
        score: r.score ?? null,
        explanation: r.explanation ?? null,
        createdAt: r.createdAt,
      })),
      suggestions: suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 40)
        .map((s) => ({
          id: s._id,
          forName: name(s.forUserId),
          forRole: byId.get(s.forUserId)?.role,
          candidateName: name(s.candidateId),
          score: s.score,
          factors: { semantic: s.semanticScore, availability: s.availabilityScore, preferences: s.preferenceScore, pace: s.goalScore },
          sharedPairs: s.sharedPairs.slice(0, 3),
          retrievalMode: s.retrievalMode,
          computedAt: s.computedAt,
        })),
      unmatched: profiles
        .filter((p) => p.role !== "admin" && !matched.has(p.userId))
        .map((p) => ({ id: p.userId, name: p.name, role: p.role, ...avatar(p.userId), since: p.onboardedAt, mossStatus: p.mossStatus })),
    };
  },
});

export const reports = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");
    const rows = await ctx.db.query("safetyReports").order("desc").take(30);
    const out = [];
    for (const r of rows) {
      const a = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", r.reporterId)).unique();
      const b = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", r.reportedId)).unique();
      out.push({ ...r, reporterName: a?.name ?? "?", reportedName: b?.name ?? "?" });
    }
    return out;
  },
});

export const markReportReviewed = mutation({
  args: { id: v.id("safetyReports") },
  handler: async (ctx, { id }) => {
    await requireRole(ctx, "admin");
    await ctx.db.patch(id, { status: "reviewed" });
  },
});

export const mossIndexHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");
    const count = (rows: Array<{ mossStatus: string }>) => ({
      indexed: rows.filter((r) => r.mossStatus === "indexed").length,
      pending: rows.filter((r) => r.mossStatus === "pending").length,
      skipped: rows.filter((r) => r.mossStatus === "skipped").length,
      errors: rows.filter((r) => r.mossStatus === "error").length,
    });
    return {
      profiles: count(await ctx.db.query("profiles").collect()),
      memories: count(await ctx.db.query("memoryEntries").collect()),
      insights: count(await ctx.db.query("learningInsights").collect()),
    };
  },
});

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getProfile, publicProfile, requireCallMember, requireRelationshipMember, requireUser } from "./lib/authz";
import { suggestSlots, type Slot } from "./lib/time";
import { logEvent } from "./integrations";

const WEEK_MS = 7 * 24 * 3600 * 1000;

export const suggestedTimes = query({
  args: { relationshipId: v.id("buddyRelationships") },
  handler: async (ctx, { relationshipId }) => {
    const { user, buddyId } = await requireRelationshipMember(ctx, relationshipId);
    const mine = await ctx.db.query("availability").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    const theirs = await ctx.db.query("availability").withIndex("by_user", (q) => q.eq("userId", buddyId)).unique();
    const buddy = await getProfile(ctx, buddyId);
    if (!mine || !theirs) return { slots: [], buddyTimezone: buddy?.timezone ?? "UTC" };
    return {
      slots: suggestSlots(mine.slots as Slot[], mine.timezone, theirs.slots as Slot[], theirs.timezone, Date.now(), 8),
      buddyTimezone: theirs.timezone,
    };
  },
});

export const propose = mutation({
  args: {
    relationshipId: v.id("buddyRelationships"),
    startAt: v.number(),
    durationMin: v.number(),
    topic: v.optional(v.string()),
    recurrence: v.union(v.literal("none"), v.literal("weekly")),
  },
  handler: async (ctx, args) => {
    const { user, rel } = await requireRelationshipMember(ctx, args.relationshipId);
    if (args.startAt < Date.now() - 5 * 60000) throw new ConvexError("Please pick a time in the future.");
    if (args.durationMin < 10 || args.durationMin > 120) throw new ConvexError("Calls can be 10–120 minutes.");
    const seriesId = args.recurrence === "weekly" ? `${rel._id}-${args.startAt}` : undefined;
    const occurrences = args.recurrence === "weekly" ? 4 : 1;
    let firstId = null;
    for (let i = 0; i < occurrences; i++) {
      const id = await ctx.db.insert("scheduledCalls", {
        relationshipId: rel._id,
        studentId: rel.studentId,
        seniorId: rel.seniorId,
        proposedBy: user._id,
        startAt: args.startAt + i * WEEK_MS,
        durationMin: args.durationMin,
        topic: args.topic,
        status: "proposed",
        recurrence: args.recurrence,
        seriesId,
        createdAt: Date.now(),
      });
      firstId ??= id;
    }
    await logEvent(ctx, { service: "convex", operation: "call.proposed", status: "success", mode: "live", detail: `${occurrences} occurrence(s)` });
    return firstId;
  },
});

/** Instant "Call a buddy now" — creates a confirmed call starting now. */
export const callNow = mutation({
  args: { relationshipId: v.id("buddyRelationships") },
  handler: async (ctx, { relationshipId }) => {
    const { user, rel } = await requireRelationshipMember(ctx, relationshipId);
    const existing = await ctx.db.query("scheduledCalls").withIndex("by_relationship", (q) => q.eq("relationshipId", rel._id)).collect();
    const now = Date.now();
    const live = existing.find((c) => (c.status === "in_progress" || c.status === "confirmed") && Math.abs(c.startAt - now) < 15 * 60000);
    if (live) return live._id;
    return ctx.db.insert("scheduledCalls", {
      relationshipId: rel._id,
      studentId: rel.studentId,
      seniorId: rel.seniorId,
      proposedBy: user._id,
      startAt: now,
      durationMin: 30,
      status: "confirmed",
      recurrence: "none",
      createdAt: now,
    });
  },
});

export const respond = mutation({
  args: { callId: v.id("scheduledCalls"), accept: v.boolean(), wholeSeries: v.optional(v.boolean()) },
  handler: async (ctx, { callId, accept, wholeSeries }) => {
    const { user, call } = await requireCallMember(ctx, callId);
    if (call.proposedBy === user._id) throw new ConvexError("Your buddy needs to confirm this time.");
    if (call.status !== "proposed") throw new ConvexError("This call was already answered.");
    const targets =
      wholeSeries && call.seriesId
        ? await ctx.db.query("scheduledCalls").withIndex("by_series", (q) => q.eq("seriesId", call.seriesId)).collect()
        : [call];
    for (const c of targets) if (c.status === "proposed") await ctx.db.patch(c._id, { status: accept ? "confirmed" : "declined" });
    await logEvent(ctx, { service: "convex", operation: accept ? "call.confirmed" : "call.declined", status: "success", mode: "live" });
  },
});

export const reschedule = mutation({
  args: { callId: v.id("scheduledCalls"), startAt: v.number() },
  handler: async (ctx, { callId, startAt }) => {
    const { user, call } = await requireCallMember(ctx, callId);
    if (call.status === "completed" || call.status === "in_progress") throw new ConvexError("This call can't be moved.");
    if (startAt < Date.now()) throw new ConvexError("Please pick a time in the future.");
    // A new time needs the other person's confirmation again.
    await ctx.db.patch(callId, { startAt, status: "proposed", proposedBy: user._id });
  },
});

export const cancel = mutation({
  args: { callId: v.id("scheduledCalls"), wholeSeries: v.optional(v.boolean()) },
  handler: async (ctx, { callId, wholeSeries }) => {
    const { call } = await requireCallMember(ctx, callId);
    const targets =
      wholeSeries && call.seriesId
        ? await ctx.db.query("scheduledCalls").withIndex("by_series", (q) => q.eq("seriesId", call.seriesId)).collect()
        : [call];
    for (const c of targets)
      if (c.status === "proposed" || c.status === "confirmed") await ctx.db.patch(c._id, { status: "cancelled" });
  },
});

export const upcoming = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const since = Date.now() - 3 * 3600 * 1000;
    const rows =
      user.role === "student"
        ? await ctx.db.query("scheduledCalls").withIndex("by_student", (q) => q.eq("studentId", user._id).gte("startAt", since)).collect()
        : await ctx.db.query("scheduledCalls").withIndex("by_senior", (q) => q.eq("seniorId", user._id).gte("startAt", since)).collect();
    const out = [];
    for (const c of rows) {
      if (!["proposed", "confirmed", "in_progress"].includes(c.status)) continue;
      if (c.status !== "in_progress" && c.startAt + c.durationMin * 60000 < Date.now()) continue;
      const buddyId = c.studentId === user._id ? c.seniorId : c.studentId;
      const p = await getProfile(ctx, buddyId);
      if (!p) continue;
      out.push({ ...c, buddy: publicProfile(p), needsMyResponse: c.status === "proposed" && c.proposedBy !== user._id });
    }
    return out.sort((a, b) => a.startAt - b.startAt);
  },
});

export const getCall = query({
  args: { callId: v.id("scheduledCalls") },
  handler: async (ctx, { callId }) => {
    const { user, call, buddyId } = await requireCallMember(ctx, callId);
    const buddy = await getProfile(ctx, buddyId);
    const me = await getProfile(ctx, user._id);
    const conversation = call.conversationId ? await ctx.db.get(call.conversationId) : null;
    // Prompts come from what the two of them talked about before (shared, non-sensitive topics).
    const prior = await ctx.db.query("conversations").withIndex("by_relationship", (q) => q.eq("relationshipId", call.relationshipId)).order("desc").take(3);
    const rel = await ctx.db.get(call.relationshipId);
    return {
      call,
      myRole: user.role,
      me: me ? publicProfile(me) : null,
      buddy: buddy ? publicProfile(buddy) : null,
      sharedInterests: rel?.sharedInterests ?? [],
      conversation: conversation
        ? {
            _id: conversation._id,
            processing: conversation.processing,
            durationSec: conversation.durationSec,
            endedAt: conversation.endedAt,
            studentConsent: conversation.studentConsent,
            seniorConsent: conversation.seniorConsent,
          }
        : null,
      priorTopics: [...new Set(prior.flatMap((p) => p.nextTopics ?? []))].slice(0, 4),
    };
  },
});

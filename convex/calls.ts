import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getProfile, publicProfile, requireCallMember, requireUser } from "./lib/authz";
import { logEvent } from "./integrations";

const PRESENCE_TTL = 20_000;

async function ensureConversation(ctx: MutationCtx, call: Doc<"scheduledCalls">): Promise<Id<"conversations">> {
  if (call.conversationId) return call.conversationId;
  const id = await ctx.db.insert("conversations", {
    callId: call._id,
    relationshipId: call.relationshipId,
    studentId: call.studentId,
    seniorId: call.seniorId,
    startedAt: Date.now(),
    studentConsent: false,
    seniorConsent: false,
    recordings: [],
    processing: "not_consented",
  });
  await ctx.db.patch(call._id, { conversationId: id, status: "in_progress" });
  return id;
}

export const join = mutation({
  args: { callId: v.id("scheduledCalls"), sessionId: v.string(), micOn: v.boolean(), camOn: v.boolean() },
  handler: async (ctx, { callId, sessionId, micOn, camOn }) => {
    const { user, call } = await requireCallMember(ctx, callId);
    if (call.status === "cancelled" || call.status === "declined") throw new ConvexError("This call was cancelled.");
    if (call.status === "completed") throw new ConvexError("This call has already ended.");
    if (call.status === "proposed") throw new ConvexError("This call still needs to be confirmed by your buddy.");
    const rel = await ctx.db.get(call.relationshipId);
    if (rel?.status === "blocked") throw new ConvexError("This connection has been blocked.");
    await ensureConversation(ctx, call);
    const existing = await ctx.db.query("callPresence").withIndex("by_call_user", (q) => q.eq("callId", callId).eq("userId", user._id)).unique();
    const now = Date.now();
    if (existing) await ctx.db.patch(existing._id, { sessionId, joinedAt: now, lastSeen: now, micOn, camOn, consent: false });
    else await ctx.db.insert("callPresence", { callId, userId: user._id, sessionId, joinedAt: now, lastSeen: now, consent: false, micOn, camOn });
    await logEvent(ctx, { service: "webrtc", operation: "call.join", status: "success", mode: "live", detail: "signaling via Convex" });
  },
});

export const heartbeat = mutation({
  args: { callId: v.id("scheduledCalls"), sessionId: v.string(), micOn: v.boolean(), camOn: v.boolean() },
  handler: async (ctx, { callId, sessionId, micOn, camOn }) => {
    const user = await requireUser(ctx);
    const p = await ctx.db.query("callPresence").withIndex("by_call_user", (q) => q.eq("callId", callId).eq("userId", user._id)).unique();
    if (p && p.sessionId === sessionId) await ctx.db.patch(p._id, { lastSeen: Date.now(), micOn, camOn });
  },
});

export const leave = mutation({
  args: { callId: v.id("scheduledCalls"), sessionId: v.string() },
  handler: async (ctx, { callId, sessionId }) => {
    const user = await requireUser(ctx);
    const p = await ctx.db.query("callPresence").withIndex("by_call_user", (q) => q.eq("callId", callId).eq("userId", user._id)).unique();
    if (p && p.sessionId === sessionId) await ctx.db.delete(p._id);
  },
});

/** Explicit, per-call opt-in to recording + transcription. Both people must opt in for AI processing. */
export const setConsent = mutation({
  args: { callId: v.id("scheduledCalls"), consent: v.boolean() },
  handler: async (ctx, { callId, consent }) => {
    const { user, call } = await requireCallMember(ctx, callId);
    const convId = await ensureConversation(ctx, call);
    const p = await ctx.db.query("callPresence").withIndex("by_call_user", (q) => q.eq("callId", callId).eq("userId", user._id)).unique();
    if (p) await ctx.db.patch(p._id, { consent });
    const conv = (await ctx.db.get(convId))!;
    const patch = user._id === call.studentId ? { studentConsent: consent } : { seniorConsent: consent };
    const both = (user._id === call.studentId ? consent : conv.studentConsent) && (user._id === call.seniorId ? consent : conv.seniorConsent);
    await ctx.db.patch(convId, { ...patch, processing: both ? "awaiting_audio" : "not_consented" });
  },
});

export const presence = query({
  args: { callId: v.id("scheduledCalls") },
  handler: async (ctx, { callId }) => {
    const { user } = await requireCallMember(ctx, callId);
    const rows = await ctx.db.query("callPresence").withIndex("by_call", (q) => q.eq("callId", callId)).collect();
    // Note: freshness is evaluated client-side too, since queries are cached until data changes.
    return rows.map((r) => ({
      userId: r.userId,
      isMe: r.userId === user._id,
      sessionId: r.sessionId,
      joinedAt: r.joinedAt,
      lastSeen: r.lastSeen,
      consent: r.consent,
      micOn: r.micOn,
      camOn: r.camOn,
      ttl: PRESENCE_TTL,
    }));
  },
});

export const sendSignal = mutation({
  args: {
    callId: v.id("scheduledCalls"),
    fromSessionId: v.string(),
    toSessionId: v.string(),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, buddyId } = await requireCallMember(ctx, args.callId);
    if (args.payload.length > 20000) throw new ConvexError("Signal too large.");
    await ctx.db.insert("callSignals", { ...args, fromUserId: user._id, toUserId: buddyId, createdAt: Date.now() });
  },
});

export const signals = query({
  args: { callId: v.id("scheduledCalls"), sessionId: v.string() },
  handler: async (ctx, { callId, sessionId }) => {
    const { user } = await requireCallMember(ctx, callId);
    return ctx.db
      .query("callSignals")
      .withIndex("by_target", (q) => q.eq("callId", callId).eq("toUserId", user._id).eq("toSessionId", sessionId))
      .collect();
  },
});

export const end = mutation({
  args: { callId: v.id("scheduledCalls") },
  handler: async (ctx, { callId }) => {
    const { call } = await requireCallMember(ctx, callId);
    if (!call.conversationId) {
      await ctx.db.patch(callId, { status: "completed" });
      return null;
    }
    const conv = (await ctx.db.get(call.conversationId))!;
    if (!conv.endedAt) {
      const endedAt = Date.now();
      const durationSec = Math.round((endedAt - conv.startedAt) / 1000);
      const consented = conv.studentConsent && conv.seniorConsent;
      await ctx.db.patch(conv._id, { endedAt, durationSec, processing: consented ? "awaiting_audio" : "not_consented" });
      await ctx.db.patch(callId, { status: "completed" });
      const rel = await ctx.db.get(call.relationshipId);
      if (rel) await ctx.db.patch(rel._id, { callsCompleted: rel.callsCompleted + 1, lastCallAt: endedAt });
      for (const s of await ctx.db.query("callSignals").withIndex("by_target", (q) => q.eq("callId", callId)).collect()) {
        await ctx.db.delete(s._id);
      }
      await logEvent(ctx, { service: "webrtc", operation: "call.ended", status: "success", mode: "live", detail: `${durationSec}s` });
      // Safety net: process whatever audio has arrived after 90s, even if one upload never lands.
      if (consented) await ctx.scheduler.runAfter(90_000, internal.pipeline.process, { conversationId: conv._id, force: true });
    }
    return conv._id;
  },
});

export const generateUploadUrl = mutation({
  args: { callId: v.id("scheduledCalls") },
  handler: async (ctx, { callId }) => {
    const { user, call } = await requireCallMember(ctx, callId);
    const conv = call.conversationId ? await ctx.db.get(call.conversationId) : null;
    const mine = user._id === call.studentId ? conv?.studentConsent : conv?.seniorConsent;
    if (!mine) throw new ConvexError("Recording requires your consent.");
    return ctx.storage.generateUploadUrl();
  },
});

export const attachRecording = mutation({
  args: { callId: v.id("scheduledCalls"), storageId: v.id("_storage"), startedAt: v.number(), mimeType: v.string() },
  handler: async (ctx, { callId, storageId, startedAt, mimeType }) => {
    const { user, call } = await requireCallMember(ctx, callId);
    if (!call.conversationId) throw new ConvexError("No conversation.");
    const conv = (await ctx.db.get(call.conversationId))!;
    const consented = conv.studentConsent && conv.seniorConsent;
    if (!consented) {
      await ctx.storage.delete(storageId); // never keep audio without both people's consent
      return;
    }
    const recordings = [...conv.recordings.filter((r) => r.userId !== user._id), { userId: user._id, storageId, startedAt, mimeType }];
    await ctx.db.patch(conv._id, { recordings });
    if (recordings.length >= 2 && conv.endedAt) {
      await ctx.scheduler.runAfter(0, internal.pipeline.process, { conversationId: conv._id, force: false });
    }
  },
});

export const submitFeedback = mutation({
  args: { conversationId: v.id("conversations"), rating: v.number(), note: v.optional(v.string()) },
  handler: async (ctx, { conversationId, rating, note }) => {
    const user = await requireUser(ctx);
    const conv = await ctx.db.get(conversationId);
    if (!conv) throw new ConvexError("Not found");
    const fb = { rating: Math.max(1, Math.min(5, Math.round(rating))), note: note?.slice(0, 500) };
    if (conv.studentId === user._id) await ctx.db.patch(conv._id, { feedbackFromStudent: fb });
    else if (conv.seniorId === user._id) await ctx.db.patch(conv._id, { feedbackFromSenior: fb });
    else throw new ConvexError("Not found");
  },
});

export const recentConversations = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const user = await requireUser(ctx);
    const rows =
      user.role === "student"
        ? await ctx.db.query("conversations").withIndex("by_student", (q) => q.eq("studentId", user._id)).order("desc").take(limit ?? 10)
        : await ctx.db.query("conversations").withIndex("by_senior", (q) => q.eq("seniorId", user._id)).order("desc").take(limit ?? 10);
    const out = [];
    for (const c of rows) {
      const buddyId = c.studentId === user._id ? c.seniorId : c.studentId;
      const p = await getProfile(ctx, buddyId);
      out.push({
        _id: c._id,
        callId: c.callId,
        startedAt: c.startedAt,
        durationSec: c.durationSec,
        processing: c.processing,
        processingError: c.processingError,
        sharedTopics: c.sharedTopics ?? [],
        buddy: p ? publicProfile(p) : null,
      });
    }
    return out;
  },
});

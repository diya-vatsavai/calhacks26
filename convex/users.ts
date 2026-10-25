import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getConsent, getProfile, requireUser } from "./lib/authz";
import { slotV } from "./schema";
import { logEvent } from "./integrations";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const profile = await getProfile(ctx, userId);
    const consent = await getConsent(ctx, userId);
    const availability = await ctx.db
      .query("availability")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const interests = await ctx.db
      .query("interests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role ?? null,
      isDemo: user.isDemo ?? false,
      profile,
      consent,
      availability,
      interests: interests.filter((i) => i.kind === "interest").map((i) => i.label),
    };
  },
});

const onboardingArgs = {
  name: v.string(),
  avatar: v.string(),
  avatarColor: v.string(),
  bio: v.optional(v.string()),
  timezone: v.string(),
  interests: v.array(v.string()),
  topics: v.array(v.string()),
  slots: v.array(slotV),
  proficiency: v.optional(v.string()),
  nativeLanguage: v.optional(v.string()),
  learningGoals: v.optional(v.array(v.string())),
  callFormat: v.optional(v.string()),
  accessibility: v.optional(
    v.object({ largeText: v.boolean(), highContrast: v.boolean(), captions: v.boolean(), slowerSpeech: v.boolean() }),
  ),
  ageConfirmed: v.boolean(),
  consent: v.object({
    recordCalls: v.boolean(),
    transcribe: v.boolean(),
    storeTranscripts: v.boolean(),
    learningFeedback: v.boolean(),
    memoryBook: v.boolean(),
    indexInMoss: v.boolean(),
  }),
};

export const completeOnboarding = mutation({
  args: onboardingArgs,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role !== "student" && user.role !== "senior") throw new ConvexError("Only students and seniors onboard.");
    if (!args.ageConfirmed) throw new ConvexError("Kindred is for adults aged 18 and above.");
    if (args.interests.length < 2) throw new ConvexError("Pick at least two interests so we can find great matches.");
    const t0 = Date.now();
    const role = user.role;
    const existing = await getProfile(ctx, user._id);
    const profileFields = {
      userId: user._id,
      role,
      name: args.name.trim(),
      avatar: args.avatar,
      avatarColor: args.avatarColor,
      bio: args.bio,
      timezone: args.timezone,
      topics: args.topics,
      proficiency: role === "student" ? args.proficiency : undefined,
      nativeLanguage: role === "student" ? args.nativeLanguage : undefined,
      learningGoals: role === "student" ? args.learningGoals : undefined,
      callFormat: role === "senior" ? args.callFormat : undefined,
      accessibility: role === "senior" ? args.accessibility : undefined,
      ageConfirmed: true,
      onboardedAt: existing?.onboardedAt ?? Date.now(),
      // New interests need (re)indexing in Moss for semantic matching.
      mossStatus: "pending" as const,
    };
    if (existing) await ctx.db.patch(existing._id, profileFields);
    else await ctx.db.insert("profiles", profileFields);
    await ctx.db.patch(user._id, { name: args.name.trim() });

    for (const i of await ctx.db.query("interests").withIndex("by_user", (q) => q.eq("userId", user._id)).collect()) {
      await ctx.db.delete(i._id);
    }
    for (const label of args.interests) await ctx.db.insert("interests", { userId: user._id, label, kind: "interest" });
    for (const label of args.topics) await ctx.db.insert("interests", { userId: user._id, label, kind: "topic" });

    const avail = await ctx.db.query("availability").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    if (avail) await ctx.db.patch(avail._id, { slots: args.slots, timezone: args.timezone });
    else await ctx.db.insert("availability", { userId: user._id, slots: args.slots, timezone: args.timezone });

    const consent = await getConsent(ctx, user._id);
    if (consent) await ctx.db.patch(consent._id, { ...args.consent, updatedAt: Date.now() });
    else await ctx.db.insert("userConsent", { userId: user._id, ...args.consent, updatedAt: Date.now() });

    await logEvent(ctx, {
      service: "convex",
      operation: "profile.onboard",
      status: "success",
      mode: "live",
      latencyMs: Date.now() - t0,
      detail: `${role} profile stored`,
    });
  },
});

export const updateConsent = mutation({
  args: {
    recordCalls: v.boolean(),
    transcribe: v.boolean(),
    storeTranscripts: v.boolean(),
    learningFeedback: v.boolean(),
    memoryBook: v.boolean(),
    indexInMoss: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const consent = await getConsent(ctx, user._id);
    if (consent) await ctx.db.patch(consent._id, { ...args, updatedAt: Date.now() });
    else await ctx.db.insert("userConsent", { userId: user._id, ...args, updatedAt: Date.now() });
    // Withdrawing indexing consent removes the user's documents from search.
    if (!args.indexInMoss) {
      for (const m of await ctx.db.query("memoryEntries").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect()) {
        if (m.mossStatus === "indexed") await ctx.db.patch(m._id, { mossStatus: "removed" });
      }
      for (const l of await ctx.db.query("learningInsights").withIndex("by_student", (q) => q.eq("studentId", user._id)).collect()) {
        if (l.mossStatus === "indexed") await ctx.db.patch(l._id, { mossStatus: "removed" });
      }
    }
  },
});

export const updateAvailability = mutation({
  args: { slots: v.array(slotV), timezone: v.string() },
  handler: async (ctx, { slots, timezone }) => {
    const user = await requireUser(ctx);
    const avail = await ctx.db.query("availability").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    if (avail) await ctx.db.patch(avail._id, { slots, timezone });
    else await ctx.db.insert("availability", { userId: user._id, slots, timezone });
    const profile = await getProfile(ctx, user._id);
    if (profile) await ctx.db.patch(profile._id, { timezone });
  },
});

/** Permanently removes the caller's learning data and memories (and queues Moss removal). */
export const deletePersonalData = mutation({
  args: { what: v.union(v.literal("memories"), v.literal("learning"), v.literal("both")) },
  handler: async (ctx, { what }) => {
    const user = await requireUser(ctx);
    let removed = 0;
    if (what !== "learning") {
      for (const m of await ctx.db.query("memoryEntries").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect()) {
        if (m.photoStorageId) await ctx.storage.delete(m.photoStorageId);
        // Keep a tombstone only if Moss still holds the document, so the service layer can delete it.
        if (m.mossStatus === "indexed") await ctx.db.patch(m._id, { mossStatus: "removed", summary: "", stories: [], moments: [], title: "Deleted" });
        else await ctx.db.delete(m._id);
        removed++;
      }
    }
    if (what !== "memories") {
      for (const l of await ctx.db.query("learningInsights").withIndex("by_student", (q) => q.eq("studentId", user._id)).collect()) {
        if (l.mossStatus === "indexed") await ctx.db.patch(l._id, { mossStatus: "removed", summary: "" });
        else await ctx.db.delete(l._id);
        removed++;
      }
      for (const s of await ctx.db.query("practiceSessions").withIndex("by_student", (q) => q.eq("studentId", user._id)).collect()) {
        await ctx.db.delete(s._id);
      }
      for (const e of await ctx.db.query("practiceExercises").withIndex("by_student", (q) => q.eq("studentId", user._id)).collect()) {
        await ctx.db.delete(e._id);
      }
    }
    return { removed };
  },
});

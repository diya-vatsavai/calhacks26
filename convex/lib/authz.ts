import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;
export type Role = "student" | "senior" | "admin";

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Please sign in to continue.");
  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError("Account not found.");
  return user;
}

export async function requireRole(ctx: Ctx, ...roles: Role[]): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!user.role || !roles.includes(user.role)) {
    throw new ConvexError("You don't have permission to do that.");
  }
  return user;
}

export async function getProfile(ctx: Ctx, userId: Id<"users">) {
  return ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function requireProfile(ctx: Ctx) {
  const user = await requireUser(ctx);
  const profile = await getProfile(ctx, user._id);
  if (!profile) throw new ConvexError("Please finish onboarding first.");
  return { user, profile };
}

/** Ensures the caller is one of the two people in a buddy relationship. */
export async function requireRelationshipMember(ctx: Ctx, relationshipId: Id<"buddyRelationships">) {
  const user = await requireUser(ctx);
  const rel = await ctx.db.get(relationshipId);
  if (!rel || (rel.studentId !== user._id && rel.seniorId !== user._id)) {
    throw new ConvexError("That friendship isn't available.");
  }
  if (rel.status === "blocked") throw new ConvexError("This connection has been blocked.");
  return { user, rel, buddyId: rel.studentId === user._id ? rel.seniorId : rel.studentId };
}

export async function requireCallMember(ctx: Ctx, callId: Id<"scheduledCalls">) {
  const user = await requireUser(ctx);
  const call = await ctx.db.get(callId);
  if (!call || (call.studentId !== user._id && call.seniorId !== user._id)) {
    throw new ConvexError("That call isn't available.");
  }
  return { user, call, buddyId: call.studentId === user._id ? call.seniorId : call.studentId };
}

/** Server-to-server calls from the Next.js service layer (Moss indexing) use a shared secret. */
export function requireServerSecret(secret: string) {
  const expected = process.env.KINDRED_SERVER_SECRET;
  if (!expected || secret !== expected) throw new ConvexError("Unauthorized server call.");
}

export async function getConsent(ctx: Ctx, userId: Id<"users">) {
  return ctx.db
    .query("userConsent")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export function publicProfile(p: Doc<"profiles">) {
  return {
    userId: p.userId,
    role: p.role,
    name: p.name,
    avatar: p.avatar,
    avatarColor: p.avatarColor,
    bio: p.bio,
    timezone: p.timezone,
    proficiency: p.proficiency,
    nativeLanguage: p.nativeLanguage,
    callFormat: p.callFormat,
    topics: p.topics,
  };
}

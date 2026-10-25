// Shared Lamb constants. Kept free of function definitions so both the default-runtime module
// (convex/lamb.ts) and the node-runtime action (convex/lambAI.ts) can import it safely.
import { v } from "convex/values";

export const supportV = v.union(v.literal("off"), v.literal("gentle"), v.literal("helpful"), v.literal("guided"));
export type Support = "off" | "gentle" | "helpful" | "guided";

export const momentKindV = v.union(v.literal("spark"), v.literal("rescue"), v.literal("gloss"));
export const triggerV = v.union(
  v.literal("asked"),
  v.literal("hesitation"),
  v.literal("lull"),
  v.literal("rare_phrase"),
);

/**
 * The support ladder — the Lamb's brakes.
 * `auto` caps how many moments a WHOLE call may contain unasked, `cooldownMs` is the minimum gap
 * between them and `gloss` caps automatically explained phrases. The client asks; the server
 * decides (see lambAI.assist). "off" never silences an answer the student explicitly asked for:
 * the ladder only limits what the Lamb starts by itself.
 */
export const LADDER: Record<Support, { auto: number; cooldownMs: number; gloss: number }> = {
  off: { auto: 0, cooldownMs: 0, gloss: 0 },
  gentle: { auto: 3, cooldownMs: 90_000, gloss: 1 },
  helpful: { auto: 8, cooldownMs: 45_000, gloss: 3 },
  guided: { auto: 16, cooldownMs: 20_000, gloss: 6 },
};

export const DEFAULT_SUPPORT: Support = "helpful";

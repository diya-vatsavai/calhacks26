import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireRole, requireUser } from "./lib/authz";

const serviceV = v.union(v.literal("convex"), v.literal("cartesia"), v.literal("moss"), v.literal("llm"), v.literal("webrtc"));
const statusV = v.union(v.literal("success"), v.literal("error"), v.literal("fallback"), v.literal("skipped"));
const modeV = v.union(v.literal("live"), v.literal("demo"));

export type IntegrationEvent = {
  service: "convex" | "cartesia" | "moss" | "llm" | "webrtc";
  operation: string;
  status: "success" | "error" | "fallback" | "skipped";
  mode: "live" | "demo";
  latencyMs?: number;
  detail?: string;
};

/** Strip anything that looks like a credential and cap length — events are shown on the admin monitor. */
export function sanitize(detail?: string) {
  if (!detail) return undefined;
  return detail
    .replace(/(sk[-_][A-Za-z0-9_-]{8,})/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .slice(0, 240);
}

export async function logEvent(ctx: MutationCtx, e: IntegrationEvent) {
  await ctx.db.insert("integrationEvents", { ...e, detail: sanitize(e.detail), createdAt: Date.now() });
}

export const record = internalMutation({
  args: { service: serviceV, operation: v.string(), status: statusV, mode: modeV, latencyMs: v.optional(v.number()), detail: v.optional(v.string()) },
  handler: async (ctx, args) => logEvent(ctx, args),
});

/** Called by the Next.js service layer (Cartesia TTS/STT, Moss) on behalf of a signed-in user. */
export const report = mutation({
  args: { service: serviceV, operation: v.string(), status: statusV, mode: modeV, latencyMs: v.optional(v.number()), detail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await logEvent(ctx, args);
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireRole(ctx, "admin");
    return ctx.db.query("integrationEvents").withIndex("by_created").order("desc").take(limit ?? 60);
  },
});

export const summary = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");
    const events = await ctx.db.query("integrationEvents").withIndex("by_created").order("desc").take(500);
    const services = ["convex", "cartesia", "moss", "llm", "webrtc"] as const;
    return services.map((service) => {
      const mine = events.filter((e) => e.service === service);
      const withLatency = mine.filter((e) => typeof e.latencyMs === "number");
      const ops = new Map<string, number>();
      for (const e of mine) ops.set(e.operation, (ops.get(e.operation) ?? 0) + 1);
      return {
        service,
        total: mine.length,
        success: mine.filter((e) => e.status === "success").length,
        errors: mine.filter((e) => e.status === "error").length,
        fallbacks: mine.filter((e) => e.status === "fallback").length,
        live: mine.filter((e) => e.mode === "live").length,
        avgLatencyMs: withLatency.length
          ? Math.round(withLatency.reduce((n, e) => n + (e.latencyMs ?? 0), 0) / withLatency.length)
          : null,
        lastAt: mine[0]?.createdAt ?? null,
        lastError: mine.find((e) => e.status === "error")?.detail ?? null,
        operations: [...ops.entries()].map(([name, count]) => ({ name, count })),
      };
    });
  },
});

/** A cheap reactive heartbeat the monitor uses to prove live Convex subscriptions. */
export const ping = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");
    await logEvent(ctx, { service: "convex", operation: "reactive.ping", status: "success", mode: "live" });
  },
});

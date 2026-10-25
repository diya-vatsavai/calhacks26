import "server-only";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../convex/_generated/api";
import type { IntegrationEvent } from "../../../convex/integrations";

const URL = process.env.NEXT_PUBLIC_CONVEX_URL!;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** A Convex client that acts as the signed-in user (Convex enforces authorization). */
export function userClient(req: Request) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new HttpError(401, "Please sign in.");
  const client = new ConvexHttpClient(URL);
  client.setAuth(token);
  return client;
}

export function serverSecret() {
  const s = process.env.KINDRED_SERVER_SECRET;
  if (!s) throw new HttpError(500, "KINDRED_SERVER_SECRET is not configured.");
  return s;
}

/** Fire-and-forget integration telemetry (never includes content or credentials). */
export function report(client: ConvexHttpClient, e: IntegrationEvent) {
  client.mutation(api.integrations.report, e).catch(() => {});
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  const msg = (e as { data?: string })?.data ?? (e as Error)?.message ?? "Something went wrong";
  const status = /sign in|Unauthenticated/i.test(String(msg)) ? 401 : 500;
  return NextResponse.json({ error: typeof msg === "string" ? msg : "Something went wrong" }, { status });
}

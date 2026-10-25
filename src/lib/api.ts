"use client";
import { useAuthToken } from "@convex-dev/auth/react";
import { useCallback } from "react";

/** Calls Kindred's Next.js service routes (Moss / Cartesia) with the user's Convex auth token. */
export function useApi() {
  const token = useAuthToken();
  return useCallback(
    async <T = unknown>(path: string, init: { json?: unknown; form?: FormData; method?: string } = {}): Promise<T> => {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      let body: BodyInit | undefined;
      if (init.form) body = init.form;
      else if (init.json !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(init.json);
      }
      const res = await fetch(path, { method: init.method ?? (body ? "POST" : "GET"), headers, body });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        if (!res.ok) throw new ApiError(res.status, "Request failed", {});
        return res as unknown as T;
      }
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.error ?? "Request failed", data);
      return data as T;
    },
    [token],
  );
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public data: Record<string, unknown>) {
    super(message);
  }
}

export function convexErrorMessage(e: unknown) {
  const data = (e as { data?: unknown })?.data;
  if (typeof data === "string") return data;
  const msg = (e as Error)?.message ?? "Something went wrong";
  const m = msg.match(/Uncaught ConvexError: (.+?)(\n|$)/);
  return m ? m[1] : msg.replace(/\[CONVEX[^\]]*\]\s*/g, "").split("\n")[0];
}

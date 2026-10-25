import { NextResponse } from "next/server";
import { errorResponse, report, userClient } from "@/lib/server/convex";

export const runtime = "nodejs";

type IceServer = { urls: string | string[]; username?: string; credential?: string };

const STUN: IceServer = { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] };
let cache: { servers: IceServer[]; at: number } | null = null;

/**
 * ICE servers for WebRTC calls. Direct peer-to-peer (STUN) fails on many campus / venue networks,
 * so a TURN relay is used when configured:
 *   - Metered (https://www.metered.ca): METERED_TURN_APP=<appname>, METERED_TURN_API_KEY=<key>
 *   - Any other TURN provider: TURN_URLS (comma-separated), TURN_USERNAME, TURN_CREDENTIAL
 * Credentials stay server-side and are only handed to signed-in users.
 */
async function iceServers(): Promise<{ servers: IceServer[]; relay: "metered" | "static" | "none" }> {
  const app = process.env.METERED_TURN_APP;
  const key = process.env.METERED_TURN_API_KEY;
  if (app && key) {
    if (cache && Date.now() - cache.at < 10 * 60_000) return { servers: cache.servers, relay: "metered" };
    const res = await fetch(`https://${app}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error(`Metered TURN ${res.status}`);
    const servers = (await res.json()) as IceServer[];
    cache = { servers, at: Date.now() };
    return { servers, relay: "metered" };
  }
  const urls = process.env.TURN_URLS ?? process.env.NEXT_PUBLIC_TURN_URL;
  if (urls) {
    return {
      servers: [
        STUN,
        {
          urls: urls.split(",").map((u) => u.trim()).filter(Boolean),
          username: process.env.TURN_USERNAME ?? process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.TURN_CREDENTIAL ?? process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        },
      ],
      relay: "static",
    };
  }
  return { servers: [STUN], relay: "none" };
}

export async function GET(req: Request) {
  try {
    const client = userClient(req);
    try {
      const { servers, relay } = await iceServers();
      return NextResponse.json({ iceServers: servers, relay });
    } catch (e) {
      report(client, { service: "webrtc", operation: "turn.credentials", status: "error", mode: "live", detail: (e as Error).message });
      return NextResponse.json({ iceServers: [STUN], relay: "none", warning: "TURN relay unavailable" });
    }
  } catch (e) {
    return errorResponse(e);
  }
}

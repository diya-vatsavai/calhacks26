import { NextResponse } from "next/server";
import { errorResponse, userClient } from "@/lib/server/convex";
import { syncViewer } from "@/lib/server/sync";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    return NextResponse.json(await syncViewer(userClient(req)));
  } catch (e) {
    return errorResponse(e);
  }
}

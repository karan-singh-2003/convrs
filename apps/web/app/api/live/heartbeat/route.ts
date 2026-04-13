import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordHeartbeat } from "@/lib/analytics/live-visitors";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const HeartbeatSchema = z.object({
  workspaceId: z.string().min(1).max(128),
  visitorId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(128),
  page: z.string().max(2048).default("/"),
  url: z.string().max(2048).default("/"),
});

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const parsed = HeartbeatSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    await recordHeartbeat(parsed.data);
    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    console.error("[api/live/heartbeat] Error:", error);
    // Keep tracker resilient: do not surface 500s to heartbeat callers.
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
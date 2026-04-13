import { NextRequest, NextResponse } from "next/server";
import { getLiveStats } from "@/lib/analytics/live-visitors";

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, error: "workspaceId required" },
      { status: 400 }
    );
  }

  try {
    const stats = await getLiveStats(workspaceId);
    return NextResponse.json({ ok: true, ...stats }, { status: 200 });
  } catch (error) {
    console.error("[api/live/count] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to get live count" },
      { status: 500 }
    );
  }
}

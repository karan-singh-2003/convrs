import { NextRequest, NextResponse } from "next/server";
import { getLiveStats } from "@/lib/analytics/live-visitors";

export async function GET(req: NextRequest) {
  const projectToken = req.nextUrl.searchParams.get("projectToken");

  if (!projectToken) {
    return NextResponse.json(
      { ok: false, error: "projectToken required" },
      { status: 400 }
    );
  }

  try {
    const stats = await getLiveStats(projectToken);
    return NextResponse.json({ ok: true, ...stats }, { status: 200 });
  } catch (error) {
    console.error("[api/live/count] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to get live count" },
      { status: 500 }
    );
  }
}

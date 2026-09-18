import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@repo/db";
import { getLiveStats } from "@/lib/analytics/live-visitors";
import { isEntitled } from "@/lib/billing/entitlement";

// GET /api/live/count?projectToken=... — live visitor count/pages/geo for a
// workspace's tracking snippet ID.
//
// `projectToken` is the public site ID embedded in every page a customer's
// site serves (packages/tracker/src/analytics.js), so it isn't a secret —
// but the data behind it (live pages/referrers/countries) should still only
// be readable by the workspace's own members, UNLESS the workspace has
// opted into public sharing (`isPublic`, same flag the (shared) dashboard
// routes and /api/analytics/bot-filtering already key off — see
// lib/api/analytics/resolve-workspace.ts). Previously this route returned
// data for any projectToken with no check at all, which bypassed that
// isPublic gate for private workspaces even though the (shared) UI itself
// enforced it correctly.
export async function GET(req: NextRequest) {
  const projectToken = req.nextUrl.searchParams.get("projectToken");

  if (!projectToken) {
    return NextResponse.json(
      { ok: false, error: "projectToken required" },
      { status: 400 }
    );
  }

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { projectToken },
      select: {
        id: true,
        isPublic: true,
        subscriptionStatus: true,
        freeTrialEndDate: true,
        paymentFailedAt: true,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 }
      );
    }

    // Live visitor data is a paid analytics feature like any other — a
    // workspace with no active subscription/trial entitlement shouldn't be
    // able to serve it, whether the caller is a member or hitting a public
    // share link.
    if (!isEntitled(workspace)) {
      return NextResponse.json(
        { ok: false, error: "Subscription inactive" },
        { status: 402 }
      );
    }

    if (!workspace.isPublic) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 }
        );
      }

      const membership = await prisma.workspaceUsers.findFirst({
        where: { workspaceId: workspace.id, userId: session.user.id },
        select: { id: true },
      });

      if (!membership) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

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

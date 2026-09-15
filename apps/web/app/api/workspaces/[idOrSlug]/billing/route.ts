import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

// GET /api/workspaces/[idOrSlug]/billing — billing cycle + period start for the
// workspace's covering subscription. Read straight from our Subscription row
// (no Dodo round-trip — the webhook keeps it current).
export const GET = withWorkspace(
  async ({ workspace }) => {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspace.id },
      select: {
        subscription: {
          select: { billingInterval: true, currentPeriodStart: true, currentPeriodEnd: true, status: true },
        },
      },
    });

    const sub = ws?.subscription;
    const billingCycle: "monthly" | "yearly" | null = sub?.billingInterval
      ? sub.billingInterval === "year"
        ? "yearly"
        : "monthly"
      : null;
    const billingPeriodStart = sub?.currentPeriodStart
      ? Math.floor(sub.currentPeriodStart.getTime() / 1000)
      : null;

    return NextResponse.json({
      billingCycle,
      billingPeriodStart,
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      subscriptionStatus: sub?.status ?? null,
    });
  },
  { requiredPermission: "billing:read" },
);

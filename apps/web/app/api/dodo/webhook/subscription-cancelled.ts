/**
 * app/api/webhooks/dodo/subscription-cancelled.ts
 */

import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import type { DodoSubscriptionPayload } from "@/lib/dodo/types";

export async function subscriptionCancelled(data: DodoSubscriptionPayload) {
  const workspace = await prisma.workspace.findFirst({
    where: { dodoSubscriptionId: data.subscription_id },
    select: {
      id: true,
      currentPeriodEnd: true,
    },
  });

  if (!workspace) {
    return NextResponse.json({ received: true });
  }

  const now = new Date();

  const isExpired =
    data.status === "expired" ||
    (workspace.currentPeriodEnd &&
      new Date(workspace.currentPeriodEnd) < now);

  // ─────────────────────────────────────────────────────────────
  // CASE 1: Subscription cancelled but still within paid period
  // ─────────────────────────────────────────────────────────────
  if (!isExpired) {
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        subscriptionStatus: "canceling", // important distinction
      },
    });

    return NextResponse.json({ received: true });
  }

  // ─────────────────────────────────────────────────────────────
  // CASE 2: Subscription fully expired → revoke access
  // ─────────────────────────────────────────────────────────────
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      dodoSubscriptionId: null,
      subscriptionStatus: "canceled",
      billingInterval: null,
      currentPeriodEnd: null,

      // Reset to free-tier instead of hard zero (better UX)
      plan: "free",
      tierEvents: 10000, // your free plan limit
      usageLimit: 10000,

      paymentFailedAt: null,
    },
  });

  return NextResponse.json({ received: true });
}
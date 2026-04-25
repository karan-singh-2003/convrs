/**
 * app/api/webhooks/dodo/subscription-cancelled.ts
 *
 * Replaces: app/api/webhooks/stripe/customer-subscription-deleted.ts
 *
 * Triggered by: subscription.cancelled  |  subscription.expired
 *
 * Key differences from the Stripe handler:
 *  - Stripe needed a second API call (stripe.subscriptions.list) to check
 *    for other active subs on the same customer.  Dodo fires one event per
 *    subscription, so we just downgrade/restrict the workspace directly.
 *  - No "active subscription fallback" branch needed.
 */

import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import type { DodoSubscriptionPayload } from "@/lib/dodo/types";

export async function subscriptionCancelled(data: DodoSubscriptionPayload) {
  // ── Find workspace by Dodo subscription ID ────────────────────────────────
  const workspace = await prisma.workspace.findFirst({
    where:  { stripeSubscriptionId: data.subscription_id },
    select: { id: true },
  });

  if (!workspace) {
    return NextResponse.json({ received: true });
  }

  // ── Revoke access ─────────────────────────────────────────────────────────
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      dodoSubscriptionId: null,   // ← was stripeSubscriptionId
      subscriptionStatus: "canceled",
      billingInterval:    null,
      currentPeriodEnd:   null,
      tierEvents:         null,
      usageLimit:         0,       // block all usage
      paymentFailedAt:    null,
    },
  });

  return NextResponse.json({ received: true });
}
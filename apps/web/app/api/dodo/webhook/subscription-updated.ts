/**
 * app/api/webhooks/dodo/subscription-updated.ts
 *
 * Replaces: app/api/webhooks/stripe/customer-subscription-updated.ts
 *           + app/api/webhooks/stripe/utils/update-workspace-plan.ts
 *
 * Triggered by:
 *   subscription.updated      – any field change (plan, interval, status, …)
 *   subscription.renewed      – billing cycle renewed, new next_billing_date
 *   subscription.on_hold      – payment failed, subscription paused
 *   subscription.plan_changed – upgrade / downgrade via Change Plan API
 *
 * All four events share the same DodoSubscriptionPayload shape, so one
 * handler covers everything that your old customerSubscriptionUpdated did.
 */

import { prisma } from "@repo/db";
import { getPlanFromProductId } from "@repo/utils";
import { NextResponse } from "next/server";
import type { DodoSubscriptionPayload } from "@/lib/dodo/types";
import { SubscriptionStatus, WorkspacePlan } from "@prisma/client";

export async function subscriptionUpdated(data: DodoSubscriptionPayload) {
  // ── Find workspace by Dodo subscription ID ────────────────────────────────
  // (was: findFirst where stripeSubscriptionId)
  const workspace = await prisma.workspace.findFirst({
    where: { dodoSubscriptionId: data.subscription_id },
    select: {
      id: true,
      subscriptionStatus: true,
      freeTrialEndDate: true,
      plan: true,
      paymentFailedAt: true,
    },
  });

  if (!workspace) {
    // Could be a brand-new subscription before subscription.active fired.
    // Safe to skip — subscription.active will handle first-write.
    return NextResponse.json({ received: true });
  }

  // ── Resolve plan from product_id ──────────────────────────────────────────
  // Destructure interval too — we use it to update billingInterval precisely
  // rather than re-deriving it from payment_frequency_interval.
  const { plan: newPlan, interval } = getPlanFromProductId(data.product_id);

  // ── Billing interval ──────────────────────────────────────────────────────
  // Prefer the interval resolved from the product ID (authoritative), fall
  // back to payment_frequency_interval from the payload.
  const billingInterval: "month" | "year" =
    interval === "yearly"
      ? "year"
      : interval === "monthly"
        ? "month"
        : data.payment_frequency_interval === "Year"
          ? "year"
          : "month";

  // ── Period end ────────────────────────────────────────────────────────────
  const currentPeriodEnd = data.next_billing_date
    ? new Date(data.next_billing_date)
    : null;

  // ── Trial-awareness (mirrors Stripe handler exactly) ──────────────────────
  const now = new Date();
  const isTrialActive =
    workspace.freeTrialEndDate &&
    workspace.freeTrialEndDate > now &&
    data.status === "active";

  const canApplyPlanLimits = !isTrialActive && ["active"].includes(data.status);

  // ── Map Dodo status → your DB status ─────────────────────────────────────
  // Dodo has no "canceling" concept — it uses cancel_at_next_billing_date.
  // We mirror your Stripe handler: if cancel is scheduled, write "canceling".
  const dbStatus: SubscriptionStatus = data.cancel_at_next_billing_date
    ? "canceling"
    : data.status === "past_due"
      ? "past_due" // keep your existing column values consistent
      : data.status; // "active" | "cancelled" | "expired" | "failed"

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      dodoSubscriptionId: data.subscription_id,
      subscriptionStatus: dbStatus,
      billingInterval,
      currentPeriodEnd,

      // Apply plan limits only when eligible
      ...(canApplyPlanLimits &&
        newPlan && {
          plan: newPlan.name
            .toLowerCase()
            .replace(/\s+/g, "_") as WorkspacePlan,
          tierEvents: newPlan.limits.events,
          usageLimit: newPlan.limits.events,
        }),

      // Payment failed → record the timestamp
      ...(data.status === "past_due" && {
        paymentFailedAt: workspace.paymentFailedAt ?? new Date(),
      }),

      // Recovered from failure → clear the timestamp
      ...(data.status === "active" && {
        paymentFailedAt: null,
      }),
    },
  });

  return NextResponse.json({ received: true });
}

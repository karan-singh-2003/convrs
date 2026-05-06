/**
 * app/api/webhooks/dodo/subscription-active.ts
 *
 * Replaces: app/api/webhooks/stripe/checkout-session-completed.ts
 *
 * Triggered by: subscription.active
 * Fires once: first payment succeeded, subscription is now live.
 *
 * Key differences from the Stripe handler:
 *  - No second round-trip to retrieve the subscription; all data is in the payload.
 *  - workspaceId comes from metadata (set in the checkout session).
 *  - product_id → plan lookup via getPlanFromProductId (searches both monthly
 *    and yearly product IDs, returns the matched interval too).
 *  - billingInterval derived from payment_frequency_interval ("Month" | "Year").
 *  - currentPeriodEnd = next_billing_date (ISO string → Date).
 */

import { prisma } from "@repo/db";
import { onboardingStepCache } from "@/lib/workspaces/omboarding-step-cache";
import UpgradeEmail from "@repo/email/templates/upgrade-email";
import { sendBatchEmail } from "@repo/email";
import { getPlanFromProductId } from "@repo/utils";
import { NextResponse } from "next/server";
import type { User } from "@repo/db/client";
import type { WorkspaceProps } from "@/lib/types";
import type { DodoSubscriptionPayload } from "@/lib/dodo/types";

export async function subscriptionActive(data: DodoSubscriptionPayload) {
  const workspaceId = data.metadata?.workspaceId;

  if (!workspaceId) {
    console.warn("[dodo/subscription-active] No workspaceId in metadata");
    return NextResponse.json({ received: true });
  }

  // ── Resolve plan from Dodo product ID ──────────────────────────────────────
  // getPlanFromProductId searches BOTH ids.monthly and ids.yearly, so this
  // works regardless of which billing cycle the customer chose.
  const { plan, interval } = getPlanFromProductId(data.product_id);

  if (!plan) {
    console.warn(
      `[dodo/subscription-active] Unknown product_id: ${data.product_id}`
    );
    return NextResponse.json({ received: true });
  }

  // ── Billing interval ───────────────────────────────────────────────────────
  // Prefer the interval we resolved from the product ID (most reliable),
  // fall back to payment_frequency_interval from the payload.
  const billingInterval: "month" | "year" =
    interval === "yearly"
      ? "year"
      : interval === "monthly"
      ? "month"
      : data.payment_frequency_interval === "Year"
      ? "year"
      : "month";

  // ── currentPeriodEnd ───────────────────────────────────────────────────────
  const currentPeriodEnd = data.next_billing_date
    ? new Date(data.next_billing_date)
    : null;

  // ── Trial-awareness (mirrors your Stripe handler exactly) ─────────────────
  const existingWorkspace = await prisma.workspace.findUnique({
    where:  { id: workspaceId },
    select: { freeTrialEndDate: true },
  });

  if (!existingWorkspace) {
    return NextResponse.json({ received: true });
  }

  const now = new Date();
  const isTrialActive =
    existingWorkspace.freeTrialEndDate &&
    existingWorkspace.freeTrialEndDate > now &&
    data.status === "active";

  // Only apply the new plan limits once the trial has ended
  const canApplyPlanLimits = !isTrialActive && data.status === "active";

  // ── Write to DB ────────────────────────────────────────────────────────────
  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      // ← was stripeCustomerId / stripeSubscriptionId
      stripeCustomerId:     data.customer.customer_id,
      stripeSubscriptionId: data.subscription_id,

      subscriptionStatus: data.status,       // "active"
      billingInterval,
      currentPeriodEnd,

      ...(canApplyPlanLimits && {
        plan:       plan.name.toLowerCase(),
        tierEvents: plan.limits.events,
        usageLimit: plan.limits.events,
      }),
    },
    select: {
      users: {
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const users = workspace.users.map(({ user }) => ({
    id:    user.id,
    email: user.email,
    name:  user.name,
  }));

  const asyncTasks: Promise<unknown>[] = [
    completeOnboarding({ workspaceId, users }),
  ];

  if (canApplyPlanLimits) {
    asyncTasks.push(
      sendBatchEmail(
        users.map((user) => ({
          to:      user.email!,
          subject: "Your workspace has been upgraded!",
          react:   UpgradeEmail({
            name:  user.name!,
            plan:  plan.name,
            email: user.email!,
          }),
        }))
      )
    );
  }

  await Promise.allSettled(asyncTasks);
  return NextResponse.json({ received: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function completeOnboarding({
  workspaceId,
  users,
}: {
  workspaceId: string;
  users: Pick<User, "id">[];
}) {
  const workspace = (await prisma.workspace.findUnique({
    where:   { id: workspaceId },
    include: { users: true },
  })) as unknown as WorkspaceProps | null;

  if (!workspace) return;

  await Promise.allSettled([
    onboardingStepCache.mset({
      userIds: users.map(({ id }) => id),
      step:    "completed",
    }),
  ]);
}
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
import { SubscriptionStatus, WorkspacePlan } from "@prisma/client";

export async function subscriptionActive(data: DodoSubscriptionPayload) {
  console.log("[dodo/subscription-active] Received payload:", data);
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
    where: { id: workspaceId },
    select: { freeTrialEndDate: true, dodoCustomerId: true },
  });

  if (!existingWorkspace) {
    return NextResponse.json({ received: true });
  }

  const now = new Date();
  const isTrialActive =
    existingWorkspace.freeTrialEndDate &&
    existingWorkspace.freeTrialEndDate > now &&
    data.status === "active";

  // ── Idempotency & conflict check ───────────────────────────────────────────
  // Case 1: this workspace already has a *different* dodoCustomerId assigned.
  // That's a hard conflict (shouldn't happen) — log and abort.
  if (
    existingWorkspace.dodoCustomerId &&
    existingWorkspace.dodoCustomerId !== data.customer.customer_id
  ) {
    console.warn(
      `[dodo/subscription-active] Customer ID mismatch for workspace ${workspaceId}: ` +
        `existing=${existingWorkspace.dodoCustomerId}, incoming=${data.customer.customer_id}`
    );
    return NextResponse.json({ received: true });
  }

  // Case 2: this workspace has no dodoCustomerId yet, but the incoming
  // customer_id might already be attached to a DIFFERENT workspace (e.g. the
  // same billing email was used to start a subscription for another
  // workspace previously). Since dodoCustomerId is @unique on Workspace,
  // writing it here would violate that constraint — this is what was
  // throwing P2002. Check ahead of time so we can skip the field gracefully
  // instead of crashing the write.
  let shouldSetCustomerId = existingWorkspace.dodoCustomerId === null;

  if (shouldSetCustomerId) {
    const ownerOfCustomerId = await prisma.workspace.findUnique({
      where: { dodoCustomerId: data.customer.customer_id },
      select: { id: true },
    });

    if (ownerOfCustomerId && ownerOfCustomerId.id !== workspaceId) {
      console.warn(
        `[dodo/subscription-active] customer_id ${data.customer.customer_id} is already ` +
          `attached to workspace ${ownerOfCustomerId.id}, not ${workspaceId}. ` +
          `Skipping dodoCustomerId assignment to avoid unique constraint violation.`
      );
      shouldSetCustomerId = false;
    }
  }

  // ── Write to DB ────────────────────────────────────────────────────────────
  let workspace;
  try {
    workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        // Only set dodoCustomerId if it's unset AND not already owned by
        // another workspace (checked above).
        ...(shouldSetCustomerId && {
          dodoCustomerId: data.customer.customer_id,
        }),
        dodoSubscriptionId: data.subscription_id,

        subscriptionStatus: data.status, // "active"
        billingInterval,
        currentPeriodEnd,

        plan: plan.name.toLowerCase().replace(/\s+/g, "_") as WorkspacePlan,
        tierEvents: plan.limits.events,
        usageLimit: plan.limits.events,
      },
      select: {
        users: {
          select: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  } catch (err: any) {
    // Defensive fallback for the race window between the check above and
    // this write (e.g. two webhooks for the same customer arriving at once).
    // If it's the dodoCustomerId unique constraint, retry once without it.
    if (err?.code === "P2002" && shouldSetCustomerId) {
      console.warn(
        `[dodo/subscription-active] dodoCustomerId race detected for workspace ${workspaceId}, retrying without it`
      );
      workspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          dodoSubscriptionId: data.subscription_id,
          subscriptionStatus: data.status,
          billingInterval,
          currentPeriodEnd,
          plan: plan.name.toLowerCase().replace(/\s+/g, "_") as WorkspacePlan,
          tierEvents: plan.limits.events,
          usageLimit: plan.limits.events,
        },
        select: {
          users: {
            select: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    } else {
      throw err;
    }
  }

  const users = workspace.users.map(({ user }) => ({
    id: user.id,
    email: user.email,
    name: user.name,
  }));

  const asyncTasks: Promise<unknown>[] = [
    completeOnboarding({ workspaceId, users }),
  ];

  asyncTasks.push(
    sendBatchEmail(
      users.map((user) => ({
        to: user.email!,
        subject: "Your workspace has been upgraded!",
        react: UpgradeEmail({
          name: user.name!,
          plan: plan.name,
          email: user.email!,
        }),
      }))
    )
  );

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
    where: { id: workspaceId },
    include: { users: true },
  })) as unknown as WorkspaceProps | null;

  if (!workspace) return;

  await Promise.allSettled([
    onboardingStepCache.mset({
      userIds: users.map(({ id }) => id),
      step: "completed",
    }),
  ]);
}
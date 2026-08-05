/**
 * lib/billing/apply-subscription-plan.ts
 *
 * Single place that resolves a Dodo webhook payload into a plan/family and
 * writes it to the Workspace row. Both subscription-active.ts and
 * subscription-updated.ts call this instead of each re-implementing the
 * same "resolve product_id -> plan -> write workspace" logic.
 *
 * FIX included here: the old subscription-updated.ts gated plan-limit
 * application on `!isTrialActive`, where isTrialActive checked the
 * workspace's OWN cardless freeTrialEndDate. That meant a user who upgrades
 * DURING their cardless trial would have their brand-new paid subscription's
 * webhook arrive, and the handler would REFUSE to grant plan features
 * because the (unrelated) cardless trial timestamp hadn't expired yet.
 * That's backwards — once a real Dodo subscription+product_id exists for
 * this workspace, its status ("active" or "trialing", if Dodo's
 * trial_period_days is in effect) is what should gate access, not our own
 * separate cardless-trial bookkeeping.
 */

import { prisma } from "@repo/db";
import { getPlanFromProductId } from "@repo/utils";
import type { DodoSubscriptionPayload } from "@/lib/dodo/types";
import type { Prisma, SubscriptionStatus, WorkspacePlan, PricingFamily } from "@prisma/client";

// Dodo's exact status string during a trial_period_days-backed subscription
// isn't fully documented as either "trialing" or "active" — treating both
// as "grant access now" is the safe interpretation regardless of which one
// they actually send.
const ACCESS_GRANTING_STATUSES = new Set(["active", "trialing"]);

export async function applySubscriptionPlan({
  workspaceId,
  data,
  extraData,
}: {
  workspaceId: string;
  data: DodoSubscriptionPayload;
  /** Extra fields to merge into the same update call (e.g. dodoCustomerId
   *  assignment logic that's specific to first-activation). */
  extraData?: Prisma.WorkspaceUpdateInput;
}) {
  const { plan, interval, family } = getPlanFromProductId(data.product_id);

  if (!plan || !family) {
    console.warn(`[applySubscriptionPlan] Unknown product_id: ${data.product_id}`);
    return null;
  }

  const billingInterval: "month" | "year" =
    interval === "yearly"
      ? "year"
      : interval === "monthly"
        ? "month"
        : data.payment_frequency_interval === "Year"
          ? "year"
          : "month";

  const currentPeriodEnd = data.next_billing_date ? new Date(data.next_billing_date) : null;

  // Dodo has no "canceling" concept of its own — it uses
  // cancel_at_next_billing_date to signal a scheduled (not yet effective)
  // cancellation, mirrored here as our own "canceling" status.
  const dbStatus: SubscriptionStatus = data.cancel_at_next_billing_date
    ? ("canceling" as SubscriptionStatus)
    : data.status === "past_due"
      ? ("past_due" as SubscriptionStatus)
      : (data.status as SubscriptionStatus);

  const canApplyPlanLimits = ACCESS_GRANTING_STATUSES.has(data.status);

  const planEnumValue = plan.name.toLowerCase().replace(/\s+/g, "_") as WorkspacePlan;

  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      dodoSubscriptionId: data.subscription_id,
      subscriptionStatus: dbStatus,
      billingInterval,
      currentPeriodEnd,

      ...(canApplyPlanLimits && {
        plan: planEnumValue,
        planFamily: family as PricingFamily,
        tierEvents: plan.limits.events,
        usageLimit: plan.limits.events,
        paymentFailedAt: null,
      }),

      ...(data.status === "past_due" && {
        paymentFailedAt: new Date(),
      }),

      ...extraData,
    },
    select: {
      users: {
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return { workspace, plan, family, interval: billingInterval };
}
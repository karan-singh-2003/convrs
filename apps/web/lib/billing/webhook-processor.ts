/**
 * lib/billing/webhook-processor.ts
 *
 * Processes one verified Dodo subscription webhook inside a single
 * transaction. Idempotent (Scenario 10):
 *   - all Subscription writes are absolute values
 *   - fan-out is one workspace.updateMany to absolute values
 *   - workspaceCount recomputed via count(), never incremented here
 *   - out-of-order guarded by Subscription.lastEventAt
 *   - side effects (welcome email / onboarding) gated on welcomeEmailSentAt
 *
 * NO legacy dual-write — see fan-out.ts.
 */

import { prisma } from "@repo/db";
import { Prisma } from "@repo/db/client";
import type { SubscriptionStatus } from "@prisma/client";
import { sendBatchEmail } from "@repo/email";
import UpgradeEmail from "@repo/email/templates/upgrade-email";
import { onboardingStepCache } from "@/lib/workspaces/omboarding-step-cache";
import { resolvePlanByProductId, FAMILY_MAX_WORKSPACES } from "@/lib/billing/plan-resolver";
import {
  fanOutSubscription,
  recomputeWorkspaceCount,
  INACTIVE_BASELINE,
} from "@/lib/billing/fan-out";
import { consolidateStandardSubs } from "@/lib/billing/subscription-service";
import { resetUsageForSubscription } from "@/lib/billing/usage-reset";
import type { DodoSubscriptionPayload, PendingPlanChange } from "@/lib/dodo/types";

export const RELEVANT_EVENTS = new Set([
  "subscription.active",
  "subscription.updated",
  "subscription.renewed",
  "subscription.plan_changed",
  "subscription.on_hold",
  "subscription.cancelled",
  "subscription.expired",
  "subscription.failed",
]);

const ACCESS_GRANTING = new Set(["active", "trialing"]);

/** Dodo subscription status -> our Prisma SubscriptionStatus. */
function mapStatus(dodoStatus: string, cancelAtNextBilling: boolean): SubscriptionStatus {
  if (cancelAtNextBilling && !["cancelled", "expired"].includes(dodoStatus)) return "canceling";
  switch (dodoStatus) {
    case "active":
      return "active";
    case "on_hold":
    case "paused":
    case "failed":
      return "past_due";
    case "cancelled":
      return "canceled";
    case "expired":
      return "expired";
    case "pending":
    default:
      return "inactive";
  }
}

/**
 * True when a `downgrade_to_standard` pending change is due but has no
 * `keepWorkspaceId` — in that case the detach step below must be skipped
 * rather than run, because a Prisma filter value of `undefined` is dropped at
 * any nesting depth: `id: { not: undefined }` silently becomes "no `id`
 * filter at all", which would detach every workspace on the subscription
 * (including the one meant to survive) instead of none. Pure — unit-tested.
 */
function isUnsafeDowngradeDetach(pending: PendingPlanChange): boolean {
  return pending.kind === "downgrade_to_standard" && !pending.keepWorkspaceId;
}

type SideEffect = () => Promise<void>;

export async function processWebhookEvent(
  event: { type: string; timestamp: string; data: DodoSubscriptionPayload },
  webhookId: string,
): Promise<void> {
  const data = event.data;
  const eventTs = new Date(event.timestamp || Date.now());
  const sideEffects: SideEffect[] = [];

  await prisma.$transaction(async (tx) => {
    // ── resolve our Subscription row ──
    const metaId = data.metadata?.internalSubscriptionId;
    let sub =
      metaId
        ? await tx.subscription.findUnique({ where: { id: metaId } })
        : await tx.subscription.findUnique({ where: { dodoSubscriptionId: data.subscription_id } });

    if (!sub && data.subscription_id) {
      sub = await tx.subscription.findUnique({ where: { dodoSubscriptionId: data.subscription_id } });
    }

    if (!sub) {
      if (event.type !== "subscription.active") {
        await markDone(tx, webhookId); // pre-active race — wait for active
        return;
      }
      // defensive: active with no row we can find — create from payload
      const resolved = resolvePlanByProductId(data.product_id);
      sub = await tx.subscription.create({
        data: {
          ownerUserId: await resolveOwnerUserId(tx, data),
          dodoSubscriptionId: data.subscription_id,
          dodoCustomerId: data.customer.customer_id,
          dodoProductId: data.product_id,
          planFamily: resolved?.family ?? "standard",
          planTier: resolved?.tier ?? "t10k",
          tierEvents: resolved?.tierEvents ?? 0,
          billingInterval: resolved?.billingInterval ?? "month",
          currency: (data.currency ?? "USD").toUpperCase(),
          status: "inactive",
          maxWorkspaces: FAMILY_MAX_WORKSPACES[resolved?.family ?? "standard"],
          workspaceCount: 0,
        },
      });
    }

    // ── out-of-order guard ──
    if (sub.lastEventAt && eventTs < sub.lastEventAt) {
      await markDone(tx, webhookId);
      return;
    }

    const resolved = resolvePlanByProductId(data.product_id);
    const status = mapStatus(data.status, data.cancel_at_next_billing_date);
    const currentPeriodStart = data.previous_billing_date ? new Date(data.previous_billing_date) : sub.currentPeriodStart;
    const currentPeriodEnd = data.next_billing_date ? new Date(data.next_billing_date) : sub.currentPeriodEnd;

    // ── compute patch ──
    const patch: Prisma.SubscriptionUpdateInput = {
      status,
      dodoSubscriptionId: data.subscription_id,
      dodoCustomerId: data.customer.customer_id,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: data.cancel_at_next_billing_date,
      lastEventAt: eventTs,
      lastWebhookId: webhookId,
      currency: (data.currency ?? sub.currency ?? "USD").toUpperCase(),
    };

    if (event.type === "subscription.on_hold" || event.type === "subscription.failed" || status === "past_due") {
      patch.paymentFailedAt = sub.paymentFailedAt ?? new Date();
    } else if (status === "active") {
      patch.paymentFailedAt = null;
    }

    // plan_changed / active → adopt the product's plan (authoritative)
    if (
      (event.type === "subscription.plan_changed" ||
        event.type === "subscription.active" ||
        event.type === "subscription.updated") &&
      resolved
    ) {
      patch.planFamily = resolved.family;
      patch.planTier = resolved.tier;
      patch.tierEvents = resolved.tierEvents;
      patch.billingInterval = resolved.billingInterval;
      patch.dodoProductId = resolved.productId;
      patch.maxWorkspaces = FAMILY_MAX_WORKSPACES[resolved.family];
    }

    // pending plan change that has now taken effect
    const pending = sub.pendingPlanChange as PendingPlanChange | null;
    if (
      pending &&
      (event.type === "subscription.plan_changed" || event.type === "subscription.renewed") &&
      new Date(pending.effectiveAt) <= eventTs &&
      pending.kind !== "consolidate"
    ) {
      patch.planFamily = pending.targetFamily;
      patch.planTier = pending.targetTier;
      patch.billingInterval = pending.targetInterval === "yearly" ? "year" : "month";
      patch.maxWorkspaces = FAMILY_MAX_WORKSPACES[pending.targetFamily];
      const rp = resolvePlanByProductId(resolved?.productId ?? "");
      if (rp) patch.tierEvents = rp.tierEvents;
      patch.pendingPlanChange = Prisma.DbNull;
    }

    const updated = await tx.subscription.update({ where: { id: sub.id }, data: patch });

    // ── first activation extras ──
    if (event.type === "subscription.active") {
      await tx.user.update({
        where: { id: updated.ownerUserId },
        data: { dodoCustomerId: data.customer.customer_id },
      });

      if (data.metadata?.targetWorkspaceId) {
        await tx.workspace.updateMany({
          where: { id: data.metadata.targetWorkspaceId, subscriptionId: null },
          data: { subscriptionId: updated.id },
        });
      }

      const consolidateIds = (updated.pendingPlanChange as PendingPlanChange | null)?.consolidateStandardSubIds;
      if (consolidateIds?.length) {
        // clear the marker; consolidation runs after the tx (it makes Dodo calls)
        await tx.subscription.update({ where: { id: updated.id }, data: { pendingPlanChange: Prisma.DbNull } });
        const growthId = updated.id;
        sideEffects.push(() => consolidateStandardSubs({ growthSubscriptionId: growthId, standardSubIds: consolidateIds }));
      }
    }

    // downgrade_to_standard taking effect → detach the non-kept workspaces
    if (
      pending?.kind === "downgrade_to_standard" &&
      new Date(pending.effectiveAt) <= eventTs &&
      (event.type === "subscription.plan_changed" || event.type === "subscription.renewed")
    ) {
      if (isUnsafeDowngradeDetach(pending)) {
        console.error(
          "[webhook-processor] downgrade_to_standard pending change has no keepWorkspaceId — skipping detach",
          updated.id,
        );
      } else {
        await tx.workspace.updateMany({
          where: { subscriptionId: updated.id, id: { not: pending.keepWorkspaceId } },
          data: INACTIVE_BASELINE,
        });
      }
    }

    // ── terminal: detach everything ──
    if (updated.status === "canceled" || updated.status === "expired" || event.type === "subscription.expired") {
      await tx.workspace.updateMany({ where: { subscriptionId: updated.id }, data: INACTIVE_BASELINE });
    }

    // ── recompute seat count (idempotent) ──
    await recomputeWorkspaceCount(updated.id, tx);

    // ── fan out ──
    await fanOutSubscription(updated.id, tx);

    // ── side effects queued for after commit ──
    if (event.type === "subscription.active" && !updated.welcomeEmailSentAt) {
      const subId = updated.id;
      const family = updated.planFamily;
      const tier = updated.planTier;
      sideEffects.push(() => sendWelcomeAndCompleteOnboarding(subId, family, tier));
    }
    if (event.type === "subscription.renewed") {
      const subId = updated.id;
      sideEffects.push(async () => {
        await resetUsageForSubscription(subId);
      });
    }

    await markDone(tx, webhookId);
  });

  // ── after commit ──
  for (const fx of sideEffects) {
    try {
      await fx();
    } catch (err) {
      console.error("[webhook-processor] side effect failed", err);
    }
  }
}

async function markDone(tx: Prisma.TransactionClient, webhookId: string): Promise<void> {
  await tx.dodoWebhookEvent.update({
    where: { webhookId },
    data: { status: "done", processedAt: new Date() },
  });
}

async function resolveOwnerUserId(tx: Prisma.TransactionClient, data: DodoSubscriptionPayload): Promise<string> {
  if (data.metadata?.ownerUserId) return data.metadata.ownerUserId;
  const byCustomer = await tx.user.findFirst({
    where: { dodoCustomerId: data.customer.customer_id },
    select: { id: true },
  });
  if (byCustomer) return byCustomer.id;
  const byEmail = data.customer.email
    ? await tx.user.findFirst({ where: { email: data.customer.email }, select: { id: true } })
    : null;
  if (byEmail) return byEmail.id;
  throw new Error(`[webhook-processor] cannot resolve owner for customer ${data.customer.customer_id}`);
}

async function sendWelcomeAndCompleteOnboarding(
  subId: string,
  family: string,
  tier: string,
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subId },
    select: {
      welcomeEmailSentAt: true,
      owner: { select: { id: true, name: true, email: true } },
      workspaces: { select: { id: true } },
    },
  });
  if (!sub || sub.welcomeEmailSentAt) return;

  await prisma.subscription.update({ where: { id: subId }, data: { welcomeEmailSentAt: new Date() } });

  if (sub.owner.email) {
    await sendBatchEmail([
      {
        to: sub.owner.email,
        subject: "Your Convrs plan is active",
        react: UpgradeEmail({
          name: sub.owner.name ?? "",
          plan: `${family === "growth" ? "Growth" : "Standard"} · ${tier}`,
          email: sub.owner.email,
        }),
      },
    ]).catch((e) => console.error("[webhook-processor] welcome email failed", e));
  }

  await onboardingStepCache
    .mset({ userIds: [sub.owner.id], step: "completed" })
    .catch(() => {});
}

export { ACCESS_GRANTING, mapStatus, isUnsafeDowngradeDetach };

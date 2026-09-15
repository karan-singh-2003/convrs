/**
 * lib/billing/fan-out.ts
 *
 * The single writer of the denormalized billing cache on `Workspace`
 * (invariant I-8). Every field below is copied verbatim from the parent
 * `Subscription`; nothing else in the codebase writes these columns after
 * Deploy 2 (the old apply-subscription.ts is deleted).
 *
 * There is NO legacy dual-write (`fanOutLegacyColumns`) — the clean-slate
 * database reset removed the revert-safety rationale. Legacy Workspace columns
 * (`plan` enum, `dodoCustomerId`, `dodoSubscriptionId`, `billingInterval`) are
 * left at their defaults and dropped in Deploy 7.
 */

import { Prisma } from "@repo/db/client";

type Tx = Prisma.TransactionClient;

/** Denormalized cache values for an uncovered workspace (subscriptionId = null). */
export const INACTIVE_BASELINE = {
  subscriptionId: null,
  subscriptionStatus: "inactive",
  planFamily: "standard",
  planTier: null,
  tierEvents: 0,
  usageLimit: 0,
  currentPeriodEnd: null,
  freeTrialEndDate: null,
  paymentFailedAt: null,
  // NB: `usage` is a real per-workspace counter and is NEVER touched here.
} satisfies Prisma.WorkspaceUncheckedUpdateManyInput;

/**
 * Copy a Subscription's state onto every Workspace attached to it. One SQL
 * UPDATE regardless of 1 or 30 workspaces — atomic, no partial fan-out.
 */
export async function fanOutSubscription(subscriptionId: string, tx: Tx): Promise<number> {
  const s = await tx.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });

  const { count } = await tx.workspace.updateMany({
    where: { subscriptionId },
    data: {
      subscriptionStatus: s.status,
      planFamily: s.planFamily,
      planTier: s.planTier,
      tierEvents: s.tierEvents,
      usageLimit: s.tierEvents, // D1: per-website limit
      currentPeriodEnd: s.currentPeriodEnd,
      freeTrialEndDate: s.trialEndsAt,
      paymentFailedAt: s.paymentFailedAt,
    },
  });
  return count;
}

/** Reset one workspace's cache to the uncovered baseline (used by detach / terminal states). */
export async function resetWorkspaceCache(workspaceId: string, tx: Tx): Promise<void> {
  await tx.workspace.update({
    where: { id: workspaceId },
    data: INACTIVE_BASELINE,
  });
}

/** Reset every workspace attached to a subscription to the uncovered baseline. */
export async function detachAllWorkspaces(subscriptionId: string, tx: Tx): Promise<number> {
  const { count } = await tx.workspace.updateMany({
    where: { subscriptionId },
    data: INACTIVE_BASELINE,
  });
  return count;
}

/** Recompute Subscription.workspaceCount from the actual attached rows (idempotent). */
export async function recomputeWorkspaceCount(subscriptionId: string, tx: Tx): Promise<number> {
  const count = await tx.workspace.count({ where: { subscriptionId } });
  await tx.subscription.update({ where: { id: subscriptionId }, data: { workspaceCount: count } });
  return count;
}

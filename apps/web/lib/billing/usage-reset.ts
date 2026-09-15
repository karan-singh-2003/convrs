/**
 * lib/billing/usage-reset.ts
 *
 * Per-billing-period usage reset (D8 — the anchor is the subscription's own
 * period, not the calendar month).
 *
 *   - `resetUsageForSubscription` is the single implementation, called from the
 *     `subscription.renewed` webhook side-effect (webhook-processor.ts) and from
 *     the backstop cron below.
 *   - `resetLapsedUsagePeriods` is the cron core: it catches subscriptions whose
 *     period rolled over without a (or before the) `subscription.renewed`
 *     webhook landing.
 */

import { prisma } from "@repo/db";

/** Zero the tracked usage on every workspace attached to a subscription and stamp the reset. */
export async function resetUsageForSubscription(subId: string): Promise<number> {
  const { count } = await prisma.workspace.updateMany({
    where: { subscriptionId: subId },
    data: { usage: 0, usageLastChecked: new Date() },
  });
  await prisma.subscription
    .update({ where: { id: subId }, data: { lastUsageResetAt: new Date() } })
    .catch(() => {});
  return count;
}

export interface UsageResetReport {
  scanned: number;
  reset: number;
  subscriptionIds: string[];
}

export interface ResetCandidate {
  id: string;
  currentPeriodStart: Date | null;
  lastUsageResetAt: Date | null;
}

/**
 * A subscription is due for a usage reset when its current period started after
 * its last reset (or it was never reset). Pure — unit-tested.
 */
export function filterDueForReset(candidates: ResetCandidate[]): ResetCandidate[] {
  return candidates.filter(
    (s) =>
      s.currentPeriodStart != null &&
      (s.lastUsageResetAt == null || s.lastUsageResetAt < s.currentPeriodStart),
  );
}

/**
 * Backstop for a missed/late `subscription.renewed`: any active or trialing
 * subscription whose `currentPeriodStart` is newer than its `lastUsageResetAt`
 * (or which has never been reset) gets its workspaces' usage zeroed, anchored to
 * `currentPeriodStart` so a re-run in the same period is a no-op.
 */
export async function resetLapsedUsagePeriods(now: Date = new Date()): Promise<UsageResetReport> {
  const candidates = await prisma.subscription.findMany({
    where: {
      status: { in: ["active", "trialing"] },
      currentPeriodStart: { not: null, lte: now },
    },
    select: { id: true, currentPeriodStart: true, lastUsageResetAt: true },
  });

  const due = filterDueForReset(candidates);

  for (const s of due) {
    await prisma.workspace.updateMany({
      where: { subscriptionId: s.id },
      data: { usage: 0, usageLastChecked: now },
    });
    await prisma.subscription.update({
      where: { id: s.id },
      data: { lastUsageResetAt: s.currentPeriodStart! },
    });
  }

  return { scanned: candidates.length, reset: due.length, subscriptionIds: due.map((s) => s.id) };
}

// packages/analytics/src/mrr.ts
//
// Pure, dependency-free helpers for Monthly Recurring Revenue. Kept separate
// from subscription.ts (which pulls in prisma + attribution) so the web app
// can import the math into a hot analytics path cheaply.

export type SubscriptionInterval = "day" | "week" | "month" | "year";

export type CustomerSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "paused"
  | "canceled";

// 365.25 / 12 — average days per month, so yearly/daily/weekly plans normalize
// consistently regardless of which month the chart bucket falls in.
const DAYS_PER_MONTH = 30.4375;

/**
 * Normalize a subscription's per-period price to a monthly figure, in the same
 * currency unit as `amount` (i.e. cents in → cents out).
 *
 *   $10 / month            -> 1000
 *   $120 / year            -> 1000
 *   $2.50 / week           -> ~1085
 *   $1 / day, every 2 days -> ~1522
 */
export function monthlyAmount({
  amount,
  interval,
  intervalCount = 1,
}: {
  amount: number;
  interval: SubscriptionInterval;
  intervalCount?: number;
}): number {
  const n = intervalCount && intervalCount > 0 ? intervalCount : 1;
  switch (interval) {
    case "day":
      return (amount / n) * DAYS_PER_MONTH;
    case "week":
      return (amount / n) * (DAYS_PER_MONTH / 7);
    case "month":
      return amount / n;
    case "year":
      return amount / (n * 12);
    default:
      return amount;
  }
}

/**
 * Whether a subscription in this status counts toward MRR *while it is running*.
 * `canceled` is intentionally included: a canceled subscription still
 * contributed to MRR for every day between its start and its `canceledAt`, so
 * the historical MRR timeseries needs it — the timeseries query bounds it by
 * `canceledAt` rather than dropping it.
 */
export function statusCountsTowardMrr(status: CustomerSubscriptionStatus): boolean {
  return status === "active" || status === "past_due" || status === "canceled";
}

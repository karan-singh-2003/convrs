import {
  eachDayOfInterval,
  eachHourOfInterval,
  eachMonthOfInterval,
} from "date-fns";
import { prisma } from "@repo/db";
import { monthlyAmount, statusCountsTowardMrr } from "@repo/analytics";
import type { SubscriptionInterval } from "@repo/analytics";
import { AnalyticsFilters } from "./types";
import { getStartEndDates } from "./utils/get-start-and-end-dates";
import { convertCurrency } from "../currency/convert";

type MrrSubscription = {
  status: string;
  amount: number;
  currency: string;
  interval: SubscriptionInterval;
  intervalCount: number;
  startedAt: Date;
  canceledAt: Date | null;
};

// Empty-but-valid timeseries row — the analytics chart reads `revenue`, the
// rest satisfy its destructuring with zeros.
function emptyRow(start: string, revenue: number) {
  return {
    start,
    clicks: 0,
    leads: 0,
    sales: 0,
    conversions: 0,
    saleAmount: 0,
    revenue,
    conversion_rate: 0,
    bounce_rate: 0,
    avg_session_duration: 0,
    new_visitors: 0,
    returning_visitors: 0,
    new_revenue: revenue,
    refund_amount: 0,
    revenue_per_visitor: 0,
  };
}

async function loadSubscriptions(
  workspaceId: string,
  rangeStart: Date,
  rangeEnd: Date,
  targetCurrency: string
): Promise<Array<MrrSubscription & { monthlyInTarget: number }>> {
  const subs = await prisma.customerSubscription.findMany({
    where: {
      workspaceId,
      startedAt: { lte: rangeEnd },
      OR: [{ canceledAt: null }, { canceledAt: { gt: rangeStart } }],
    },
    select: {
      status: true,
      amount: true,
      currency: true,
      interval: true,
      intervalCount: true,
      startedAt: true,
      canceledAt: true,
    },
  });

  const eligible = subs.filter((s) => statusCountsTowardMrr(s.status as any));

  // Convert each subscription's monthly-normalized price into the workspace
  // currency once, up front.
  return Promise.all(
    eligible.map(async (s) => {
      const monthly = monthlyAmount({
        amount: s.amount,
        interval: s.interval as SubscriptionInterval,
        intervalCount: s.intervalCount,
      });
      const monthlyInTarget =
        s.currency.toUpperCase() === targetCurrency.toUpperCase()
          ? monthly
          : await convertCurrency(
              monthly,
              s.currency.toUpperCase(),
              targetCurrency.toUpperCase()
            );
      return {
        ...s,
        interval: s.interval as SubscriptionInterval,
        monthlyInTarget,
      };
    })
  );
}

/** Sum of monthly-normalized recurring revenue active at instant `at`, in cents. */
function mrrAt(
  subs: Array<MrrSubscription & { monthlyInTarget: number }>,
  at: Date
): number {
  let total = 0;
  for (const s of subs) {
    if (s.startedAt.getTime() > at.getTime()) continue;
    if (s.canceledAt && s.canceledAt.getTime() <= at.getTime()) continue;
    total += s.monthlyInTarget;
  }
  return total;
}

/**
 * Monthly Recurring Revenue over time, one point per chart bucket. MRR at a
 * bucket = the sum over all subscriptions active at the *end* of that bucket of
 * their per-period price normalized to a month, converted to the workspace's
 * display currency. Values are in cents to match the revenue series.
 */
export const getMrrTimeseries = async (params: AnalyticsFilters) => {
  const {
    workspaceId,
    interval,
    start,
    end,
    timezone = "UTC",
    dataAvailableFrom,
    currency = "USD",
  } = params;

  if (!workspaceId) return [];

  const { startDate, endDate, granularity } = getStartEndDates({
    interval,
    start,
    end,
    dataAvailableFrom,
    timezone,
  });

  const buckets =
    granularity === "month"
      ? eachMonthOfInterval({ start: startDate, end: endDate })
      : granularity === "hour" || granularity === "minute"
        ? eachHourOfInterval({ start: startDate, end: endDate })
        : eachDayOfInterval({ start: startDate, end: endDate });

  const subs = await loadSubscriptions(
    workspaceId,
    new Date(startDate.getTime()),
    new Date(endDate.getTime()),
    currency
  );

  return buckets.map((bucketStart, i) => {
    // Evaluate MRR at the end of the bucket (start of the next one, or the
    // range end for the final bucket) so a subscription started mid-bucket is
    // reflected in that bucket.
    const evalAt =
      i + 1 < buckets.length
        ? new Date(buckets[i + 1].getTime() - 1)
        : new Date(endDate.getTime());
    return emptyRow(new Date(bucketStart.getTime()).toISOString(), mrrAt(subs, evalAt));
  });
};

/** Current MRR (as of `asOf`, default now) in the workspace's display currency, cents. */
export const getMrrSnapshot = async (
  workspaceId: string,
  currency = "USD",
  asOf: Date = new Date()
): Promise<number> => {
  const subs = await loadSubscriptions(
    workspaceId,
    new Date(0),
    asOf,
    currency
  );
  return mrrAt(subs, asOf);
};

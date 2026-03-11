// lib/billing.ts

export type BillingInterval = "monthly" | "yearly";

export type BillingPeriod = {
  startDate: Date;
  endDate: Date;
};

/**
 * Returns the start and end dates for a billing period.
 * The end date is the day before the next billing cycle begins.
 *
 * @param start - The billing cycle start date (Date, timestamp, or ISO string)
 * @param interval - "monthly" or "yearly"
 */
export const getBillingPeriod = (
  start: Date | number | string,
  interval: BillingInterval
): BillingPeriod => {
  const startDate = new Date(start);

  if (isNaN(startDate.getTime())) {
    throw new Error(`Invalid start date: ${start}`);
  }

  const endDate = new Date(startDate);

  if (interval === "monthly") {
    endDate.setMonth(endDate.getMonth() + 1);
  } else {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  // Billing ends the day before the next cycle starts
  endDate.setDate(endDate.getDate() - 1);

  return { startDate, endDate };
};

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

/**
 * Formats a Date to a human-readable string, e.g. "Jan 1, 2025"
 */
export const formatBillingDate = (
  date: Date,
  locale = "en-US",
  options: Intl.DateTimeFormatOptions = DATE_FORMAT_OPTIONS
): string => date.toLocaleDateString(locale, options);

/**
 * Returns formatted [startLabel, endLabel] strings for a billing period,
 * or undefined if required inputs are missing.
 */
export const getFormattedBillingPeriod = (
  billingCycleStart: Date | number | string | null | undefined,
  billingInterval: BillingInterval | null | undefined
): [string, string] | undefined => {
  if (!billingCycleStart || !billingInterval) return undefined;

  const { startDate, endDate } = getBillingPeriod(
    billingCycleStart,
    billingInterval
  );

  return [formatBillingDate(startDate), formatBillingDate(endDate)];
};
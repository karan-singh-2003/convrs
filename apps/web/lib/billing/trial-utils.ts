/**
 * lib/billing/trial-utils.ts
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns how many whole days remain in a workspace's cardless trial,
 * rounded UP (so a user with 30 minutes left still gets a full day's grace
 * on the Dodo-side trial rather than being charged immediately due to
 * rounding down to 0). Returns null if there's no trial or it already ended
 * — callers should treat null as "do a normal checkout, no trial_period_days."
 */
export function getRemainingTrialDays(
  freeTrialEndDate: Date | null | undefined
): number | null {
  if (!freeTrialEndDate) return null;

  const now = Date.now();
  const end = freeTrialEndDate.getTime();

  if (end <= now) return null;

  return Math.max(1, Math.ceil((end - now) / DAY_MS));
}
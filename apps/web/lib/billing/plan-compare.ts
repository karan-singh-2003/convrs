/**
 * lib/billing/plan-compare.ts
 *
 * Deploy 3b — the client-side "is this selection a downgrade?" check the billing
 * UI uses to label its Apply button and warn about scheduled-at-renewal changes.
 * It must agree with `isDowngradeTransition` in subscription-service.ts (the
 * server's authority), which plan-compare.test.ts asserts across all combos.
 */

import { TIER_KEYS, type PricingFamily, type TierKey } from "@repo/utils";

export interface PlanSelection {
  family: PricingFamily;
  tier: TierKey;
}

function tierRank(tier: TierKey): number {
  const i = TIER_KEYS.indexOf(tier);
  return i === -1 ? 0 : i;
}

/**
 * True when moving `current → next` is a downgrade (schedules at period end,
 * never deletes website data). Growth→Standard is always a downgrade;
 * Standard→Growth never is; within a family the tier ladder decides.
 */
export function isDowngradeSelection(current: PlanSelection, next: PlanSelection): boolean {
  if (current.family === "growth" && next.family === "standard") return true;
  if (current.family === "standard" && next.family === "growth") return false;
  return tierRank(next.tier) < tierRank(current.tier);
}

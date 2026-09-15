/**
 * lib/billing/plan-resolver.ts
 *
 * Resolves a Dodo `product_id` <-> { family, tier, events, interval } and the
 * reverse, off the `@repo/utils` pricing catalog (`packages/utils/.../pricing.tsx`).
 *
 * (Deploy 2 sourced this from `scripts/dodo/products-spec.ts` +
 * `products.created.json`; Deploy 3a repointed it at the catalog. The public
 * API here is unchanged so `subscription-service.ts` / `webhook-processor.ts` /
 * the billing routes need no edits.)
 */

import {
  PRICING_FAMILIES,
  TIER_KEYS,
  FAMILY_LIMITS,
  getPlanFromProductId,
  getPlanByTier,
  getProductIdByTier,
  type PricingFamily,
  type TierKey,
  type PlanDetails,
} from "@repo/utils";

export type PlanFamily = PricingFamily;
export type { TierKey };
export type BillingInterval = "monthly" | "yearly";

export interface ResolvedPlan {
  family: PlanFamily;
  tier: TierKey;
  /** tier event allowance; 2_000_000_000 (Int32-safe sentinel) for the uncapped t10m_plus tier */
  tierEvents: number;
  interval: BillingInterval;
  /** "month" | "year" — the Prisma BillingInterval enum value */
  billingInterval: "month" | "year";
  productId: string;
  specKey: string;
  maxWorkspaces: number;
}

function toResolved(plan: PlanDetails, interval: BillingInterval): ResolvedPlan | null {
  const productId = plan.price.ids?.[interval];
  if (!productId) return null;
  return {
    family: plan.family,
    tier: plan.tier,
    tierEvents: plan.limits.events,
    interval,
    billingInterval: interval === "yearly" ? "year" : "month",
    productId,
    specKey: `${plan.family}.${plan.tier}.${interval}`,
    maxWorkspaces: FAMILY_LIMITS[plan.family],
  };
}

/** Resolve a Dodo product_id. Returns null for an unrecognised (retired/foreign) product. */
export function resolvePlanByProductId(productId: string | null | undefined): ResolvedPlan | null {
  if (!productId) return null;
  const { plan, interval } = getPlanFromProductId(productId);
  if (!plan || !interval) return null;
  return toResolved(plan, interval);
}

/** Get the Dodo product_id for a { family, tier, interval } combination. */
export function productIdFor(args: {
  family: PlanFamily;
  tier: TierKey;
  interval: BillingInterval;
}): string | null {
  return getProductIdByTier({ family: args.family, tier: args.tier, interval: args.interval });
}

/** Resolve a { family, tier, interval } combination to a full plan descriptor. */
export function resolvePlanBySpec(args: {
  family: PlanFamily;
  tier: TierKey;
  interval: BillingInterval;
}): ResolvedPlan | null {
  const plan = getPlanByTier({ tier: args.tier, family: args.family });
  if (!plan) return null;
  return toResolved(plan, args.interval);
}

export const ALL_TIER_KEYS: readonly TierKey[] = TIER_KEYS;
export { FAMILY_LIMITS as FAMILY_MAX_WORKSPACES };

/** true when every one of the 36 products has a product id in the catalog. */
export function catalogIsComplete(): boolean {
  return (["standard", "growth"] as PlanFamily[]).every((family) =>
    PRICING_FAMILIES[family].every((p) => Boolean(p.price.ids?.monthly && p.price.ids?.yearly)),
  );
}

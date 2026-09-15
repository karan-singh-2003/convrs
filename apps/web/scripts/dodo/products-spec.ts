/**
 * apps/web/scripts/dodo/products-spec.ts
 *
 * DEPLOY 0 — canonical spec for the 36 Convrs workspace-subscription products
 * in Dodo Payments. This file is the single source of truth for what
 * `dodo-product-audit.ts` creates and verifies.
 *
 * ── Rules ────────────────────────────────────────────────────────────────
 *  - Prices in `APPROVED_PRICING` are transcribed VERBATIM from
 *    docs/billing-invariants.md §1 (the approved pricing table).
 *    NEVER compute, round, or "correct" them. In particular:
 *      Growth yearly 100K = $390   AND   Growth yearly 200K = $390
 *    are intentionally identical — see docs/billing-invariants.md §1.
 *  - Products carry NO trial configuration. The 14-day trial is injected
 *    per-checkout via subscription_data.trial_period_days (see the
 *    implementation plan §8.4 / billing-invariants.md §9).
 *  - This spec is NOT wired into packages/utils/pricing.tsx yet — that
 *    happens in Deploy 3. Deploy 0 only creates + verifies the Dodo products
 *    and records their IDs in products.created.json.
 */

export type PlanFamily = "standard" | "growth";
export type BillingInterval = "monthly" | "yearly";

export const TIER_ORDER = [
  "t10k",
  "t100k",
  "t200k",
  "t500k",
  "t1m",
  "t2m",
  "t5m",
  "t10m",
  "t10m_plus",
] as const;
export type TierKey = (typeof TIER_ORDER)[number];

export const TIER_META: Record<
  TierKey,
  { label: string; eventsIncluded: number | null }
> = {
  t10k: { label: "10K", eventsIncluded: 10_000 },
  t100k: { label: "100K", eventsIncluded: 100_000 },
  t200k: { label: "200K", eventsIncluded: 200_000 },
  t500k: { label: "500K", eventsIncluded: 500_000 },
  t1m: { label: "1M", eventsIncluded: 1_000_000 },
  t2m: { label: "2M", eventsIncluded: 2_000_000 },
  t5m: { label: "5M", eventsIncluded: 5_000_000 },
  t10m: { label: "10M", eventsIncluded: 10_000_000 },
  // "10M+" is a flat-price, effectively uncapped tier. pricing.tsx uses a
  // 2_000_000_000 sentinel for its event limit (Int32-safe — NOT
  // Number.MAX_SAFE_INTEGER, which overflows the Postgres Int columns).
  t10m_plus: { label: "10M+", eventsIncluded: null },
};

/**
 * Approved prices in **whole US dollars**, verbatim from
 * docs/billing-invariants.md §1. Do not change without an explicit
 * instruction from the product owner.
 */
export const APPROVED_PRICING: Record<
  BillingInterval,
  Record<PlanFamily, Record<TierKey, number>>
> = {
  monthly: {
    standard: {
      t10k: 9,
      t100k: 19,
      t200k: 29,
      t500k: 49,
      t1m: 69,
      t2m: 89,
      t5m: 129,
      t10m: 169,
      t10m_plus: 199,
    },
    growth: {
      t10k: 19,
      t100k: 39,
      t200k: 59,
      t500k: 99,
      t1m: 139,
      t2m: 179,
      t5m: 259,
      t10m: 339,
      t10m_plus: 399,
    },
  },
  yearly: {
    standard: {
      t10k: 90,
      t100k: 190,
      t200k: 290,
      t500k: 490,
      t1m: 690,
      t2m: 890,
      t5m: 1_290,
      t10m: 1_690,
      t10m_plus: 1_990,
    },
    growth: {
      t10k: 190,
      t100k: 390,
      t200k: 390, // intentionally equal to t100k — see billing-invariants.md §1
      t500k: 990,
      t1m: 1_390,
      t2m: 1_790,
      t5m: 2_590,
      t10m: 3_390,
      t10m_plus: 3_990,
    },
  },
};

// ── Fixed product attributes ────────────────────────────────────────────────
export const CURRENCY = "USD" as const;
export const TAX_CATEGORY = "saas" as const;
// Matches every existing Convrs product in Dodo (verified via retrieve):
// tax_inclusive=false, discount=0, purchasing_power_parity=false.
export const TAX_INCLUSIVE = false;
export const PURCHASING_POWER_PARITY = false;
export const DISCOUNT = 0;

// The subscription's total term. MUST be strictly longer than the payment
// frequency or Dodo expires the subscription after one cycle instead of
// renewing (https://docs.dodopayments.com/developer-resources/subscription-integration-guide).
// 20 years = "effectively perpetual", and matches the longest-lived existing
// Convrs product. Applied identically to monthly AND yearly plans.
export const SUBSCRIPTION_PERIOD_INTERVAL = "Year" as const;
export const SUBSCRIPTION_PERIOD_COUNT = 20;

// Products carry NO trial. The 14-day trial is injected per-checkout via
// checkoutSessions.create({ subscription_data: { trial_period_days } }).
export const TRIAL_PERIOD_DAYS = 0;

export const PLAN_SCHEMA_VERSION = "v2";
export const FAMILY_MAX_WORKSPACES: Record<PlanFamily, number> = {
  standard: 1,
  growth: 30,
};

const FAMILY_LABEL: Record<PlanFamily, string> = {
  standard: "Standard",
  growth: "Growth",
};
const INTERVAL_WORD: Record<BillingInterval, "Month" | "Year"> = {
  monthly: "Month",
  yearly: "Year",
};
const INTERVAL_SUFFIX: Record<BillingInterval, string> = {
  monthly: "month",
  yearly: "year",
};

export interface DodoProductSpec {
  /** Stable identity: `${family}.${tier}.${interval}`. Also written to metadata.spec_key. */
  key: string;
  family: PlanFamily;
  tier: TierKey;
  interval: BillingInterval;
  eventsLabel: string;
  eventsIncluded: number | null;
  priceUsd: number;
  /** Dodo `price.price` — smallest currency unit (cents). */
  priceCents: number;
  paymentFrequencyInterval: "Month" | "Year";
  name: string;
  metadata: Record<string, string>;
}

function specFor(
  family: PlanFamily,
  tier: TierKey,
  interval: BillingInterval,
): DodoProductSpec {
  const meta = TIER_META[tier];
  const priceUsd = APPROVED_PRICING[interval][family][tier];
  const key = `${family}.${tier}.${interval}`;
  return {
    key,
    family,
    tier,
    interval,
    eventsLabel: meta.label,
    eventsIncluded: meta.eventsIncluded,
    priceUsd,
    priceCents: priceUsd * 100,
    paymentFrequencyInterval: INTERVAL_WORD[interval],
    name: `Convrs ${FAMILY_LABEL[family]} — ${meta.label} events / ${INTERVAL_SUFFIX[interval]}`,
    metadata: {
      app: "convrs",
      purpose: "workspace_subscription",
      plan_schema: PLAN_SCHEMA_VERSION,
      family,
      tier,
      events_label: meta.label,
      events_included: meta.eventsIncluded === null ? "uncapped" : String(meta.eventsIncluded),
      interval,
      max_workspaces: String(FAMILY_MAX_WORKSPACES[family]),
      spec_key: key,
    },
  };
}

export function buildSpec(): DodoProductSpec[] {
  const out: DodoProductSpec[] = [];
  for (const family of ["standard", "growth"] as const) {
    for (const tier of TIER_ORDER) {
      for (const interval of ["monthly", "yearly"] as const) {
        out.push(specFor(family, tier, interval));
      }
    }
  }
  return out;
}

/** All 36 product specs, ordered: standard first, tier ascending, monthly before yearly. */
export const PRODUCT_SPECS: DodoProductSpec[] = buildSpec();

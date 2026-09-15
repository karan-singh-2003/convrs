/**
 * packages/utils/src/constants/pricing/pricing.tsx
 *
 * The Convrs subscription-billing catalog — the single source of truth for
 * tiers, prices, event allowances, and Dodo product ids. Consumed by
 * `apps/web/lib/billing/*` (Deploy 2/3), the billing UI, and
 * `apps/web/scripts/dodo/dodo-product-audit.ts` (which verifies these ids
 * against the live Dodo catalog).
 *
 * ── Model (docs/billing-architecture-final.md + docs/billing-invariants.md) ──
 *   - Two FAMILIES: "standard" (1 workspace/subscription) and "growth"
 *     (up to 30 workspaces, unlocks X/Reddit attribution).
 *   - Nine event TIERS, identified by a stable key `t10k … t10m_plus`.
 *     `name` is a display label only; `tier` is the machine identity.
 *   - Prices are transcribed VERBATIM from docs/billing-invariants.md §1.
 *     NEVER recompute or "correct" them — in particular Growth-yearly t100k
 *     and t200k are BOTH $390 on purpose (D10).
 *   - `t10m_plus` is a flat-price, effectively uncapped tier: its
 *     `limits.events` is `UNCAPPED` (2,000,000,000 — see below) so the
 *     ingestion usage gate never trips in practice (I-10). Display code
 *     should special-case it.
 */

export type PricingFamily = "standard" | "growth";

/**
 * The tier ladder, ascending. Index = tier rank (used for up/downgrade
 * comparison). `TierKey` is derived from this tuple so the two can never drift.
 */
export const TIER_KEYS = [
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

export type TierKey = (typeof TIER_KEYS)[number];

/** Max workspaces a subscription of each family may cover (I-1 / I-2). */
export const FAMILY_LIMITS: Record<PricingFamily, number> = {
  standard: 1,
  growth: 30,
};

// NOT Number.MAX_SAFE_INTEGER: `tierEvents`/`usageLimit` are Postgres `Int`
// (32-bit, max 2,147,483,647) columns on Subscription/Workspace. Writing
// MAX_SAFE_INTEGER (9,007,199,254,740,991) into them throws "Value out of
// range for the type: ... integer" — verified against the dev DB — which
// would crash every checkout, webhook, and fan-out for the t10m_plus tier.
// 2 billion stays safely under the Int32 ceiling (with headroom for the
// 0.95x usage-warning threshold math) while remaining astronomically larger
// than any real "10M+ events" customer, and than `Workspace.usage` itself
// could ever reach (it's the same Int32 type) — still "uncapped" for every
// practical purpose.
const UNCAPPED = 2_000_000_000;

/** Event allowance per tier. `t10m_plus` is uncapped. */
export const TIER_EVENTS: Record<TierKey, number> = {
  t10k: 10_000,
  t100k: 100_000,
  t200k: 200_000,
  t500k: 500_000,
  t1m: 1_000_000,
  t2m: 2_000_000,
  t5m: 5_000_000,
  t10m: 10_000_000,
  t10m_plus: UNCAPPED,
};

/** Display label per tier (matches the "Events" column of the approved table). */
export const TIER_LABEL: Record<TierKey, string> = {
  t10k: "10K",
  t100k: "100K",
  t200k: "200K",
  t500k: "500K",
  t1m: "1M",
  t2m: "2M",
  t5m: "5M",
  t10m: "10M",
  t10m_plus: "10M+",
};

// ── Approved prices in whole US dollars — docs/billing-invariants.md §1 ──────
// Do not change without an explicit product-owner instruction.
const PRICES: Record<PricingFamily, Record<TierKey, { monthly: number; yearly: number }>> = {
  standard: {
    t10k: { monthly: 9, yearly: 90 },
    t100k: { monthly: 19, yearly: 190 },
    t200k: { monthly: 29, yearly: 290 },
    t500k: { monthly: 49, yearly: 490 },
    t1m: { monthly: 69, yearly: 690 },
    t2m: { monthly: 89, yearly: 890 },
    t5m: { monthly: 129, yearly: 1_290 },
    t10m: { monthly: 169, yearly: 1_690 },
    t10m_plus: { monthly: 199, yearly: 1_990 },
  },
  growth: {
    t10k: { monthly: 19, yearly: 190 },
    t100k: { monthly: 39, yearly: 390 },
    t200k: { monthly: 59, yearly: 390 }, // intentionally == t100k yearly (D10)
    t500k: { monthly: 99, yearly: 990 },
    t1m: { monthly: 139, yearly: 1_390 },
    t2m: { monthly: 179, yearly: 1_790 },
    t5m: { monthly: 259, yearly: 2_590 },
    t10m: { monthly: 339, yearly: 3_390 },
    t10m_plus: { monthly: 399, yearly: 3_990 },
  },
};

// ── Dodo product ids ────────────────────────────────────────────────────────
// ACTIVE catalog is Live Mode (PRODUCT_IDS below). Source of record:
// apps/web/scripts/dodo/products.created.live.json — kept in sync by
// apps/web/lib/billing/plan-resolver.test.ts (36-way equality assertion) and
// verified against the live Dodo catalog by scripts/dodo/dodo-product-audit.ts
// (DODO_PAYMENTS_ENVIRONMENT=live_mode).
//
// Test Mode ids (kept for reference — NOT used by pricing.tsx). Source of
// record: apps/web/scripts/dodo/products.created.json. To switch back to Test
// Mode, uncomment TEST_PRODUCT_IDS below and set `const PRODUCT_IDS = TEST_PRODUCT_IDS`
// (and repoint plan-resolver.test.ts's import at products.created.json).
// const TEST_PRODUCT_IDS: Record<PricingFamily, Record<TierKey, { monthly: string; yearly: string }>> = {
//   standard: {
//     t10k: { monthly: "pdt_0Nn6GJyQ9lgrVYLcclEhY", yearly: "pdt_0Nn6GJzW8OMr6Hgvb6eCp" },
//     t100k: { monthly: "pdt_0Nn6GK1Kjmp7YQSLWrzFF", yearly: "pdt_0Nn6GK2PxTo2QZi5utbIU" },
//     t200k: { monthly: "pdt_0Nn6GK3GofTQgEeTtjR0a", yearly: "pdt_0Nn6GK49DryeN28Ym42ex" },
//     t500k: { monthly: "pdt_0Nn6GK58R0iQUAKSl9UnB", yearly: "pdt_0Nn6GK5zI9PEEQrZYegd6" },
//     t1m: { monthly: "pdt_0Nn6GK6riBXG36Ap8gRvF", yearly: "pdt_0Nn6GK80iS8v9xqugFDyH" },
//     t2m: { monthly: "pdt_0Nn6GKAjBcEAiaOdajxTc", yearly: "pdt_0Nn6GKG6KbLB9htaZpmv1" },
//     t5m: { monthly: "pdt_0Nn6GKHjb1CXYV9rXR9sN", yearly: "pdt_0Nn6GKJnEjENrtU45MFAH" },
//     t10m: { monthly: "pdt_0Nn6GKKkCHAVP4207vKuB", yearly: "pdt_0Nn6GKLbp4Mq89nAS5Eoi" },
//     t10m_plus: { monthly: "pdt_0Nn6GKN6kYMHIM0HXItld", yearly: "pdt_0Nn6GKOhhUiQFwyeHeHu1" },
//   },
//   growth: {
//     t10k: { monthly: "pdt_0Nn6GKQqgnBxksLse7Xyb", yearly: "pdt_0Nn6GKUDBRt68alX8ZXTn" },
//     t100k: { monthly: "pdt_0Nn6GKVrvac0f94MehXDs", yearly: "pdt_0Nn6GKWlqk0aV4sYq4CY8" },
//     t200k: { monthly: "pdt_0Nn6GKXsYeQyafvhfsmCu", yearly: "pdt_0Nn6GKYzKTrDDuC2E4AbY" },
//     t500k: { monthly: "pdt_0Nn6GKbBIebA0D4z3pfXr", yearly: "pdt_0Nn6GKbwAibklOKCWgPr2" },
//     t1m: { monthly: "pdt_0Nn6GKck0b2ZgiZLOn7Am", yearly: "pdt_0Nn6GKdX8AsrLcGCT5CQC" },
//     t2m: { monthly: "pdt_0Nn6GKeLicEgnZWCivDIX", yearly: "pdt_0Nn6GKfsAfcv6IO5oH4UC" },
//     t5m: { monthly: "pdt_0Nn6GKgyvinSvuF3HzMXS", yearly: "pdt_0Nn6GKiBgcNWaS7sODsmh" },
//     t10m: { monthly: "pdt_0Nn6GKj46qVilJHIb5p7e", yearly: "pdt_0Nn6GKknMfBSYe2mGtqo3" },
//     t10m_plus: { monthly: "pdt_0Nn6GKn8PYk3Vxvn1M7MY", yearly: "pdt_0Nn6GKoSlUyJTKwKFaQFX" },
//   },
// };
const PRODUCT_IDS: Record<PricingFamily, Record<TierKey, { monthly: string; yearly: string }>> = {
  standard: {
    t10k: { monthly: "pdt_0NnaF2ozKD4anTieZvxfz", yearly: "pdt_0NnaF2pwFTPByyxJuq4kY" },
    t100k: { monthly: "pdt_0NnaF2qtCRGsd0R3TB37G", yearly: "pdt_0NnaF2rw973co9NSikH4F" },
    t200k: { monthly: "pdt_0NnaF2tBE6VdsWPhpH8W1", yearly: "pdt_0NnaF2u2qc1yIBMhLqH3j" },
    t500k: { monthly: "pdt_0NnaF2vzkdIAaX8Y4LFue", yearly: "pdt_0NnaF2wnZuldJeuKtu14U" },
    t1m: { monthly: "pdt_0NnaF2xxKuMGM1yxQYkH0", yearly: "pdt_0NnaF2z8cTqe6KXmQUtEQ" },
    t2m: { monthly: "pdt_0NnaF305XwqGQj6X40ZxV", yearly: "pdt_0NnaF318Y0MUk2v184bwM" },
    t5m: { monthly: "pdt_0NnaF32jVK4yFEyTxuaKr", yearly: "pdt_0NnaF33yYvAGq9t6vBSNq" },
    t10m: { monthly: "pdt_0NnaF34nxCGaaRQoXAvTW", yearly: "pdt_0NnaF35h4ayPHnpUfmWeA" },
    t10m_plus: { monthly: "pdt_0NnaF36bkcTGlX7MebjH7", yearly: "pdt_0NnaF37XuxiWiVAcL8XJl" },
  },
  growth: {
    t10k: { monthly: "pdt_0NnaF38YbfUNTuXxkv7in", yearly: "pdt_0NnaF39PUcCt5JzJWuWL2" },
    t100k: { monthly: "pdt_0NnaF3AWEYjg2vo8sIBLi", yearly: "pdt_0NnaF3Bd0JKdSSIyAgaY3" },
    t200k: { monthly: "pdt_0NnaF3CSNexJKIIhQ7cNK", yearly: "pdt_0NnaF3DT3XXtSnGg9QZKI" },
    t500k: { monthly: "pdt_0NnaF3EZ4KMGEsYAgT5He", yearly: "pdt_0NnaF3FjZyViP2jf8Kba5" },
    t1m: { monthly: "pdt_0NnaF3GlmxgXDCveQiyqn", yearly: "pdt_0NnaF3Hkz8rmnDM0dyuvy" },
    t2m: { monthly: "pdt_0NnaF3IdOGJrJUmuPaPcE", yearly: "pdt_0NnaF3JQUr0jyI4JwBlBK" },
    t5m: { monthly: "pdt_0NnaF3KIsDM69niv6lGNR", yearly: "pdt_0NnaF3L8Hq9c2Xa707JXC" },
    t10m: { monthly: "pdt_0NnaF3MCjEGhKdApb5PZq", yearly: "pdt_0NnaF3N26k2NUNG7aBUYA" },
    t10m_plus: { monthly: "pdt_0NnaF3Nw0JdfBc3XGXPpB", yearly: "pdt_0NnaF3OqgAbEzyCIyxe4h" },
  },
};

// ── Shared feature lists ────────────────────────────────────────────────────

export type PlanFeatures = {
  id: string;
  name: string;
};

const CORE_FEATURES: PlanFeatures[] = [
  { id: "analytics", name: "Full analytics dashboard" },
  { id: "bot", name: "AI-crawler / bot traffic detection" },
  { id: "attribution", name: "Marketing / revenue attribution" },
  { id: "api", name: "API, CLI & MCP access" },
  { id: "webhooks", name: "Webhook events" },
  { id: "export", name: "Data export" },
  { id: "retention", name: "5+ years of data retention" },
];

const GROWTH_FEATURES: PlanFeatures[] = [
  ...CORE_FEATURES,
  { id: "social_attribution", name: "X / Reddit link attribution & mentions" },
];

// ── Plan shape ──────────────────────────────────────────────────────────────

export type PlanDetails = {
  /** stable machine identity */
  tier: TierKey;
  /** display label, e.g. "100K" */
  name: string;
  family: PricingFamily;
  price: {
    monthly: number | null;
    yearly: number | null;
    ids?: {
      monthly: string;
      yearly: string;
    };
  };
  limits: {
    /** event allowance; UNCAPPED (2_000_000_000, Int32-safe) for the uncapped t10m_plus tier */
    events: number;
  };
  /** true for every Growth-family tier — drives lib/billing/entitlement.ts */
  unlocksSocialAttribution: boolean;
  featureTitle?: string;
  features?: PlanFeatures[];
};

function buildFamily(family: PricingFamily): PlanDetails[] {
  return TIER_KEYS.map((tier, i) => ({
    tier,
    name: TIER_LABEL[tier],
    family,
    price: {
      monthly: PRICES[family][tier].monthly,
      yearly: PRICES[family][tier].yearly,
      ids: PRODUCT_IDS[family][tier],
    },
    limits: { events: TIER_EVENTS[tier] },
    unlocksSocialAttribution: family === "growth",
    featureTitle:
      i === 0
        ? family === "growth"
          ? "Everything in Standard +"
          : "Includes:"
        : `Everything in ${TIER_LABEL[TIER_KEYS[i - 1]]} +`,
    features: family === "growth" ? GROWTH_FEATURES : CORE_FEATURES,
  }));
}

export const STANDARD_PLANS: PlanDetails[] = buildFamily("standard");
export const GROWTH_PLANS: PlanDetails[] = buildFamily("growth");

export const PRICING_FAMILIES: Record<PricingFamily, PlanDetails[]> = {
  standard: STANDARD_PLANS,
  growth: GROWTH_PLANS,
};

const ALL_PLANS: PlanDetails[] = [...STANDARD_PLANS, ...GROWTH_PLANS];

/**
 * @deprecated Prefer PRICING_FAMILIES.standard / PRICING_FAMILIES.growth, or
 * getPlanByTier. Flat array spanning BOTH families — tier labels appear twice.
 */
export const PLANS: PlanDetails[] = ALL_PLANS;

export const SELF_SERVE_PLANS = STANDARD_PLANS;

// ── Back-compat named exports (Standard family, ascending by tier) ───────────
export const Starter_Plan = STANDARD_PLANS[0];
export const Basic_Plan = STANDARD_PLANS[1];
export const Pro_Plan = STANDARD_PLANS[2];
export const Growth_Plan = STANDARD_PLANS[3];
export const Business_Plan = STANDARD_PLANS[4];
export const Scale_Plan = STANDARD_PLANS[5];
export const ProPlus_Plan = STANDARD_PLANS[6];
export const Enterprise_Plan = STANDARD_PLANS[7];
export const Ultimate_Plan = STANDARD_PLANS[8];

// ── Helpers ─────────────────────────────────────────────────────────────────

const PRODUCT_INDEX: Record<
  string,
  { plan: PlanDetails; interval: "monthly" | "yearly"; family: PricingFamily }
> = {};
for (const plan of ALL_PLANS) {
  if (!plan.price.ids) continue;
  PRODUCT_INDEX[plan.price.ids.monthly] = { plan, interval: "monthly", family: plan.family };
  PRODUCT_INDEX[plan.price.ids.yearly] = { plan, interval: "yearly", family: plan.family };
}

/** Resolve a Dodo product id → plan, family, interval. Nulls for an unknown id. */
export const getPlanFromProductId = (
  productId: string,
): {
  plan: PlanDetails | null;
  interval: "monthly" | "yearly" | null;
  family: PricingFamily | null;
} => {
  const hit = PRODUCT_INDEX[productId];
  return hit ? { plan: hit.plan, interval: hit.interval, family: hit.family } : { plan: null, interval: null, family: null };
};

/** Look up a plan by TIER KEY within a family. */
export const getPlanByTier = ({
  tier,
  family = "standard",
}: {
  tier: TierKey;
  family?: PricingFamily;
}): PlanDetails | null => PRICING_FAMILIES[family].find((p) => p.tier === tier) ?? null;

/** Look up a plan by NAME/label within a family (case-insensitive). Also accepts a tier key. */
export const getPlanDetails = ({
  plan,
  family = "standard",
}: {
  plan: string;
  family?: PricingFamily;
}): { plan: PlanDetails | null } => {
  const key = plan.toLowerCase();
  const found = PRICING_FAMILIES[family].find(
    (p) => p.name.toLowerCase() === key || p.tier === key,
  );
  return { plan: found ?? null };
};

/** Dodo product id for a tier + family + interval. */
export const getProductIdByTier = ({
  tier,
  family = "standard",
  interval,
}: {
  tier: TierKey;
  family?: PricingFamily;
  interval: "monthly" | "yearly";
}): string | null => getPlanByTier({ tier, family })?.price.ids?.[interval] ?? null;

/**
 * Dodo product id for a plan NAME/label + family + interval.
 * Kept for callers written before tier keys existed.
 */
export const getProductId = ({
  planName,
  family = "standard",
  interval,
}: {
  planName: string;
  family?: PricingFamily;
  interval: "monthly" | "yearly";
}): string | null => getPlanDetails({ plan: planName, family }).plan?.price.ids?.[interval] ?? null;

/** Next tier up within a family. Returns the top tier if already there. */
export const getNextPlan = (
  planName?: string | null,
  family: PricingFamily = "standard",
): PlanDetails => {
  const plans = PRICING_FAMILIES[family];
  if (!planName) return plans[0];
  const idx = plans.findIndex(
    (p) => p.name.toLowerCase() === planName.toLowerCase() || p.tier === planName.toLowerCase(),
  );
  if (idx === -1) return plans[0];
  return plans[Math.min(idx + 1, plans.length - 1)];
};

/**
 * True when moving current → next is a downgrade.
 *
 * Price is the primary signal (Growth always costs more than Standard at the
 * same tier, so a cross-family "same tier" move is an upgrade). When the
 * monthly price is EQUAL (only Growth-yearly t100k ↔ t200k), the tier rank
 * breaks the tie — so t100k → t200k is NOT a downgrade (more events, same
 * price) and t200k → t100k IS. See docs/billing-invariants.md §1.1.
 */
export const isDowngradePlan = ({
  currentPlan,
  currentFamily = "standard",
  newPlan,
  newFamily = "standard",
}: {
  currentPlan: string;
  currentFamily?: PricingFamily;
  newPlan: string;
  newFamily?: PricingFamily;
}): boolean => {
  const current = getPlanDetails({ plan: currentPlan, family: currentFamily }).plan;
  const next = getPlanDetails({ plan: newPlan, family: newFamily }).plan;
  if (!current || !next) return false;
  const cp = current.price.monthly ?? 0;
  const np = next.price.monthly ?? 0;
  if (np < cp) return true;
  if (np > cp) return false;
  return TIER_KEYS.indexOf(next.tier) < TIER_KEYS.indexOf(current.tier);
};

/** Format an event allowance for display (10_000 → "10K events/mo", uncapped → "10M+ events/mo"). */
export const formatEventLimit = (events: number): string => {
  if (events >= UNCAPPED) return "10M+ events/mo";
  if (events >= 1_000_000) return `${events / 1_000_000}M events/mo`;
  if (events >= 1_000) return `${events / 1_000}K events/mo`;
  return `${events} events/mo`;
};

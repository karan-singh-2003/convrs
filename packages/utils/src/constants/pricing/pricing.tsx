/**
 * packages/utils/src/pricing.ts
 *
 * Each plan has TWO separate Dodo product IDs — one for the monthly price,
 * one for the yearly price.  This matches your PRODUCT_IDS object exactly.
 *
 * getPlanFromProductId searches both ids.monthly and ids.yearly, and also
 * returns which interval matched, so webhook handlers know which billing
 * cycle was purchased.
 */

export type PlanFeatures = {
  id: string;
  name: string;
};

export type PlanDetails = {
  name: string;
  price: {
    monthly: number | null;
    yearly: number | null; // total billed yearly  (e.g. 86 = $86/yr for Starter)
    ids?: {
      monthly: string; // Dodo product ID for the monthly-billed price
      yearly: string;  // Dodo product ID for the yearly-billed price
    };
  };
  limits: {
    events: number;
  };
  featureTitle?: string;
  features?: PlanFeatures[];
};

// ─── Dodo Product IDs ─────────────────────────────────────────────────────────
// Dashboard → Products → click a plan → copy "Product ID" (pdt_xxx).
// Each plan needs two products: one priced monthly, one priced yearly.

const PRODUCT_IDS = {
  starter: {
    monthly: "pdt_0NdQZEKYFbEhiC2G1iuxI",
    yearly:  "pdt_0NdQZKlr1ulxmSL4H2pLm",
  },
  basic: {
    monthly: "pdt_0NdQZTTKkCwfKuvWEwtl2",
    yearly:  "pdt_0NdQZYyYCzDYkgGAqltpK",
  },
  pro: {
    monthly: "pdt_0NdQZe5tfdWWGVyBbEzMC",
    yearly:  "pdt_0NdQZj9gYH2urESRYKdbd",
  },
  growth: {
    monthly: "pdt_0NdQZocJrfVDBby2RMhs4",
    yearly:  "pdt_0NdQdnhULy6GydM4QmtWs",
  },
  business: {
    monthly: "pdt_0NdQZvCbP0tQpbhnmUTIp",
    yearly:  "pdt_0NdQa4CQrqsCFvt9B3dhH",
  },
  scale: {
    monthly: "pdt_0NdQa8Vc6T6NGnVx2DfPd",
    yearly:  "pdt_0NdQaDEbN58MSda9aDwwt",
  },
  pro_plus: {
    monthly: "pdt_0NdQaHQ5se9vGGkR44nds",
    yearly:  "pdt_0NdQaNTXSjo8UlZYx9ga5",
  },
} as const;

// ─── Common features ──────────────────────────────────────────────────────────

const CORE_FEATURES: PlanFeatures[] = [
  { id: "analytics", name: "Full analytics dashboard" },
  { id: "api",       name: "API access" },
  { id: "webhooks",  name: "Webhook events" },
  { id: "export",    name: "Data export" },
  { id: "support",   name: "Email support" },
  { id: "realtime",  name: "Real-time event tracking" },
  { id: "retention", name: "90-day data retention" },
];

// ─── Plans ────────────────────────────────────────────────────────────────────

export const PLANS: PlanDetails[] = [
  {
    name:  "Starter",
    price: { monthly: 9,   yearly: 86,    ids: PRODUCT_IDS.starter   },
    limits: { events: 10_000 },
    featureTitle: "Includes:",
    features: CORE_FEATURES,
  },
  {
    name:  "Basic",
    price: { monthly: 24,  yearly: 230,   ids: PRODUCT_IDS.basic     },
    limits: { events: 25_000 },
    featureTitle: "Everything in Starter +",
    features: CORE_FEATURES,
  },
  {
    name:  "Pro",
    price: { monthly: 48,  yearly: 461,   ids: PRODUCT_IDS.pro       },
    limits: { events: 100_000 },
    featureTitle: "Everything in Basic +",
    features: CORE_FEATURES,
  },
  {
    name:  "Growth",
    price: { monthly: 79,  yearly: 758,   ids: PRODUCT_IDS.growth    },
    limits: { events: 500_000 },
    featureTitle: "Everything in Pro +",
    features: CORE_FEATURES,
  },
  {
    name:  "Business",
    price: { monthly: 149, yearly: 1_430, ids: PRODUCT_IDS.business  },
    limits: { events: 1_000_000 },
    featureTitle: "Everything in Growth +",
    features: CORE_FEATURES,
  },
  {
    name:  "Scale",
    price: { monthly: 249, yearly: 2_390, ids: PRODUCT_IDS.scale     },
    limits: { events: 5_000_000 },
    featureTitle: "Everything in Business +",
    features: CORE_FEATURES,
  },
  {
    name:  "Pro Plus",
    price: { monthly: 399, yearly: 3_830, ids: PRODUCT_IDS.pro_plus  },
    limits: { events: 10_000_000 },
    featureTitle: "Everything in Scale +",
    features: CORE_FEATURES,
  },
];

// ─── Named plan exports ───────────────────────────────────────────────────────

export const Starter_Plan  = PLANS.find((p) => p.name === "Starter")!;
export const Basic_Plan    = PLANS.find((p) => p.name === "Basic")!;
export const Pro_Plan      = PLANS.find((p) => p.name === "Pro")!;
export const Growth_Plan   = PLANS.find((p) => p.name === "Growth")!;
export const Business_Plan = PLANS.find((p) => p.name === "Business")!;
export const Scale_Plan    = PLANS.find((p) => p.name === "Scale")!;
export const ProPlus_Plan  = PLANS.find((p) => p.name === "Pro Plus")!;

export const SELF_SERVE_PLANS = PLANS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find a plan AND billing interval from a Dodo product ID.
 *
 * Searches both ids.monthly and ids.yearly on every plan so webhook
 * handlers can do a single lookup and know exactly what was purchased.
 *
 * Replaces getPlanFromPriceId — same call signature, richer return value.
 */
export const getPlanFromProductId = (
  productId: string
): { plan: PlanDetails | null; interval: "monthly" | "yearly" | null } => {
  for (const plan of PLANS) {
    if (!plan.price.ids) continue;
    if (plan.price.ids.monthly === productId) return { plan, interval: "monthly" };
    if (plan.price.ids.yearly  === productId) return { plan, interval: "yearly"  };
  }
  return { plan: null, interval: null };
};

/** Find a plan by name (case-insensitive). */
export const getPlanDetails = ({
  plan,
}: {
  plan: string;
}): { plan: PlanDetails | null } => {
  const found = PLANS.find((p) => p.name.toLowerCase() === plan.toLowerCase());
  return { plan: found ?? null };
};

/**
 * Get the correct Dodo product ID for a plan + billing interval.
 * Used in the upgrade route when creating a checkout session or changing plan.
 */
export const getProductId = ({
  planName,
  interval,
}: {
  planName: string;
  interval: "monthly" | "yearly";
}): string | null => {
  const { plan } = getPlanDetails({ plan: planName });
  if (!plan?.price.ids) return null;
  return plan.price.ids[interval];
};

/** Get the next plan up from the current one. Returns last plan if already at top. */
export const getNextPlan = (planName?: string | null): PlanDetails => {
  if (!planName) return Starter_Plan;
  const idx = PLANS.findIndex(
    (p) => p.name.toLowerCase() === planName.toLowerCase()
  );
  if (idx === -1) return Starter_Plan;
  return PLANS[Math.min(idx + 1, PLANS.length - 1)];
};

/** Returns true if switching from currentPlan to newPlan is a downgrade. */
export const isDowngradePlan = ({
  currentPlan,
  newPlan,
}: {
  currentPlan: string;
  newPlan: string;
}): boolean => {
  const currentIdx = PLANS.findIndex(
    (p) => p.name.toLowerCase() === currentPlan.toLowerCase()
  );
  const newIdx = PLANS.findIndex(
    (p) => p.name.toLowerCase() === newPlan.toLowerCase()
  );
  return newIdx < currentIdx;
};

/** Format event limit for display (e.g. 1_000_000 → "1M events/mo"). */
export const formatEventLimit = (events: number): string => {
  if (events >= 1_000_000) return `${events / 1_000_000}M events/mo`;
  if (events >= 1_000)     return `${events / 1_000}K events/mo`;
  return `${events} events/mo`;
};

/**
 * @deprecated Use getPlanFromProductId instead.
 * Kept so any remaining call-sites don't break at compile time.
 */
export const getPlanFromPriceId = getPlanFromProductId as unknown as (args: {
  priceId: string;
}) => { plan: PlanDetails | null; interval: "monthly" | "yearly" | null };
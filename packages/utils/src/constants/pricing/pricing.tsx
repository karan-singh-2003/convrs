export type PlanFeatures = {
  id: string;
  name: string;
};

export type PlanDetails = {
  name: string;
  price: {
    monthly: number | null;
    yearly: number | null;
    ids?: {
      monthly: string;
      yearly: string;
    };
  };
  limits: {
    events: number; // monthly event quota
  };
  featureTitle?: string;
  features?: PlanFeatures[];
};

// ─── Stripe Price IDs ────────────────────────────────────────────────────────
// Replace each value with your actual price_xxx IDs from Stripe dashboard

const STARTER_PRICE_IDS = {
  monthly: "price_1TFutbL2qfTOZYhOVN8Hrrkz",
  yearly: "price_1TFuu1L2qfTOZYhOr8Bdn1kj",
};
const BASIC_PRICE_IDS = {
  monthly: "price_1TFv12L2qfTOZYhOONSu523a",
  yearly: "price_1TFv4aL2qfTOZYhOSKslfMeL",
};
const PRO_PRICE_IDS = {
  monthly: "price_1TFv1CL2qfTOZYhOLxjeZy9o",
  yearly: "price_1TFv4oL2qfTOZYhONNzjxhdv",
};
const GROWTH_PRICE_IDS = {
  monthly: "price_1TFv1JL2qfTOZYhOouegwoCj",
  yearly: "price_1TFv54L2qfTOZYhOceRQEcTp",
};
const BUSINESS_PRICE_IDS = {
  monthly: "price_1TFv1TL2qfTOZYhOzRYWmfnE",
  yearly: "price_1TFv5HL2qfTOZYhObdS72RnU",
};
const SCALE_PRICE_IDS = {
  monthly: "price_1TFv1gL2qfTOZYhOx7DcnxaM",
  yearly: "price_1TFv5PL2qfTOZYhO820LGX5A",
};
const PRO_PLUS_PRICE_IDS = {
  monthly: "price_1TFv1rL2qfTOZYhOmzKcf9Qq",
  yearly: "price_1TFv5cL2qfTOZYhOkzTNEWck",
};
const ENTERPRISE_PRICE_IDS = {
  monthly: "price_1TFv5yL2qfTOZYhOa9JtcpLJ",
  yearly: "price_enterprise_yearly",
};
const ULTIMATE_PRICE_IDS = {
  monthly: "price_1TFv2BL2qfTOZYhOyNWUJUuS",
  yearly: "price_1TFv6BL2qfTOZYhO586yNdXn",
};

// ─── Common features (all plans get the same features, only limits differ) ───

const CORE_FEATURES: PlanFeatures[] = [
  { id: "analytics", name: "Full analytics dashboard" },
  { id: "api", name: "API access" },
  { id: "webhooks", name: "Webhook events" },
  { id: "export", name: "Data export" },
  { id: "support", name: "Email support" },
  { id: "realtime", name: "Real-time event tracking" },
  { id: "retention", name: "90-day data retention" },
];

// ─── Plans ───────────────────────────────────────────────────────────────────

export const PLANS: PlanDetails[] = [
  {
    name: "Starter",
    price: { monthly: 9, yearly: 86, ids: STARTER_PRICE_IDS },
    limits: { events: 10_000 },
    featureTitle: "Includes:",
    features: CORE_FEATURES,
  },
  {
    name: "Basic",
    price: { monthly: 24, yearly: 230, ids: BASIC_PRICE_IDS },
    limits: { events: 25_000 },
    featureTitle: "Everything in Starter +",
    features: CORE_FEATURES,
  },
  {
    name: "Pro",
    price: { monthly: 48, yearly: 461, ids: PRO_PRICE_IDS },
    limits: { events: 100_000 },
    featureTitle: "Everything in Basic +",
    features: CORE_FEATURES,
  },
  {
    name: "Growth",
    price: { monthly: 79, yearly: 758, ids: GROWTH_PRICE_IDS },
    limits: { events: 500_000 },
    featureTitle: "Everything in Pro +",
    features: CORE_FEATURES,
  },
  {
    name: "Business",
    price: { monthly: 149, yearly: 1_430, ids: BUSINESS_PRICE_IDS },
    limits: { events: 1_000_000 },
    featureTitle: "Everything in Growth +",
    features: CORE_FEATURES,
  },
  {
    name: "Scale",
    price: { monthly: 249, yearly: 2_390, ids: SCALE_PRICE_IDS },
    limits: { events: 5_000_000 },
    featureTitle: "Everything in Business +",
    features: CORE_FEATURES,
  },
  {
    name: "Pro Plus",
    price: { monthly: 399, yearly: 3_830, ids: PRO_PLUS_PRICE_IDS },
    limits: { events: 10_000_000 },
    featureTitle: "Everything in Scale +",
    features: CORE_FEATURES,
  },
  {
    name: "Enterprise",
    price: { monthly: 569, yearly: 5_462, ids: ENTERPRISE_PRICE_IDS },
    limits: { events: 15_000_000 },
    featureTitle: "Everything in Pro Plus +",
    features: CORE_FEATURES,
  },
  {
    name: "Ultimate",
    price: { monthly: 899, yearly: 8_630, ids: ULTIMATE_PRICE_IDS },
    limits: { events: 25_000_000 },
    featureTitle: "Everything in Enterprise +",
    features: CORE_FEATURES,
  },
];

// ─── Named plan exports ───────────────────────────────────────────────────────

export const Starter_Plan = PLANS.find((p) => p.name === "Starter")!;
export const Basic_Plan = PLANS.find((p) => p.name === "Basic")!;
export const Pro_Plan = PLANS.find((p) => p.name === "Pro")!;
export const Growth_Plan = PLANS.find((p) => p.name === "Growth")!;
export const Business_Plan = PLANS.find((p) => p.name === "Business")!;
export const Scale_Plan = PLANS.find((p) => p.name === "Scale")!;
export const ProPlus_Plan = PLANS.find((p) => p.name === "Pro Plus")!;
export const Enterprise_Plan = PLANS.find((p) => p.name === "Enterprise")!;
export const Ultimate_Plan = PLANS.find((p) => p.name === "Ultimate")!;

export const SELF_SERVE_PLANS = PLANS; // all plans are self-serve

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Find a plan from a Stripe price ID (works for both monthly and yearly).
 */
export const getPlanFromPriceId = ({
  priceId,
}: {
  priceId: string;
}): { plan: PlanDetails | null; interval: "monthly" | "yearly" | null } => {
  for (const plan of PLANS) {
    if (!plan.price.ids) continue;
    if (plan.price.ids.monthly === priceId)
      return { plan, interval: "monthly" };
    if (plan.price.ids.yearly === priceId) return { plan, interval: "yearly" };
  }
  return { plan: null, interval: null };
};

/**
 * Find a plan by name (case-insensitive).
 */
export const getPlanDetails = ({
  plan,
}: {
  plan: string;
}): { plan: PlanDetails | null } => {
  const found = PLANS.find((p) => p.name.toLowerCase() === plan.toLowerCase());
  return { plan: found ?? null };
};

/**
 * Get the correct Stripe price ID for a plan + billing interval.
 * Monthly plans get a 14-day trial; yearly plans do not.
 */
export const getPriceId = ({
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

/**
 * Returns true if interval is monthly (trial-eligible).
 * Yearly plans never get a trial — pay upfront.
 */
export const isTrialEligible = (interval: "monthly" | "yearly"): boolean => {
  return interval === "monthly";
};

/**
 * Get the next plan up from the current one.
 * Returns the last plan if already at the top.
 */
export const getNextPlan = (planName?: string | null): PlanDetails => {
  if (!planName) return Starter_Plan;
  const currentIndex = PLANS.findIndex(
    (p) => p.name.toLowerCase() === planName.toLowerCase()
  );
  if (currentIndex === -1) return Starter_Plan;
  return PLANS[Math.min(currentIndex + 1, PLANS.length - 1)];
};

/**
 * Returns true if switching from currentPlan to newPlan is a downgrade.
 */
export const isDowngradePlan = ({
  currentPlan,
  newPlan,
}: {
  currentPlan: string;
  newPlan: string;
}): boolean => {
  const currentIndex = PLANS.findIndex(
    (p) => p.name.toLowerCase() === currentPlan.toLowerCase()
  );
  const newIndex = PLANS.findIndex(
    (p) => p.name.toLowerCase() === newPlan.toLowerCase()
  );
  return newIndex < currentIndex;
};

/**
 * Format event limit for display (e.g. 1_000_000 → "1M events/mo").
 */
export const formatEventLimit = (events: number): string => {
  if (events >= 1_000_000) return `${events / 1_000_000}M events/mo`;
  if (events >= 1_000) return `${events / 1_000}K events/mo`;
  return `${events} events/mo`;
};

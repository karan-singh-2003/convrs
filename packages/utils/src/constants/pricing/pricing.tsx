export type PlanFeatures = {
  id: string;
  name: string;
};

export type PlanDetails = {
  name: string;
  price: {
    monthly: number | null;
    yearly: number | null;
    ids?: string[];
  };
  limits: {
    users: number;
    // domains: number ;
    // api: number ;
  };
  featureTitle?: string;
  features?: PlanFeatures[];
};

const PRO_PRICE_IDS = [
  "price_1SyWkFL2qfTOZYhOGhm9Gng2" /* monthly */,
  "price_1SyWkuL2qfTOZYhOePbSLGUt" /* yearly */,
];

const BUSINESS_PRICE_IDS = [
  "price_1SyWlbL2qfTOZYhO65SoPBvN" /* monthly */,
  "price_1SyWm7L2qfTOZYhO2yPVffKh" /* yearly */,
];

const ADVANCED_PRICE_IDS = [
  "price_1SyWnQL2qfTOZYhOLtZW3JrI", /* monthly */
  "price_1SyWnuL2qfTOZYhOpnexxOsm", /* yearly */
];

export const Plans: PlanDetails[] = [
  { name: "Free", price: { monthly: 0, yearly: 0 }, limits: { users: 1 } },
  {
    name: "Pro",
    price: { monthly: 30, yearly: 25, ids: PRO_PRICE_IDS },
    limits: { users: 3 },
    featureTitle: "Everything in Free, plus:",
    features: [{ id: "users", name: "Up to 3 users" }],
  },
  {
    name: "Business",
    price: { monthly: 90, yearly: 75, ids: BUSINESS_PRICE_IDS },
    limits: { users: 10 },
    featureTitle: "Everything in Pro, plus:",
    features: [{ id: "users", name: "Up to 10 users" }],
  },
  {
    name: "Advanced",
    price: { monthly: 220, yearly: 175, ids: ADVANCED_PRICE_IDS },
    limits: { users: 25 },
    featureTitle: "Everything in Business, plus:",
    features: [{ id: "users", name: "Up to 25 users" }],
  },
];

export const Free_Plan = Plans.find((plan) => plan.name === "Free")!;
export const Pro_Plan = Plans.find((plan) => plan.name === "Pro")!;
export const Business_Plan = Plans.find((plan) => plan.name === "Business")!;
export const Advanced_Plan = Plans.find((plan) => plan.name === "Advanced")!;

export const getPlanFromPriceId = ({
  priceId,
}: {
  priceId: string;
}): { plan: PlanDetails | null } => {
  const planDetails = Plans.find((plan) => plan.price.ids?.includes(priceId));
  if (!planDetails) {
    return { plan: null };
  }
  return { plan: planDetails };
};

export const getPlanDetails = ({
  plan,
}: {
  plan: string;
}): { plan: PlanDetails | null } => {
  const planDetails = Plans.find(
    (p) => p.name.toLowerCase() === plan.toLowerCase()
  );
  if (!planDetails) {
    return { plan: null };
  }
  return { plan: planDetails };
};

export const getNextPlan = (plan?: string | null) => {
  if (!plan) return Pro_Plan;
  const currentPlan = plan.toLowerCase().split(" ")[0];
  return Plans[
    Math.min(
      Plans.findIndex((p) => p.name.toLowerCase() === currentPlan) + 1,
      Plans.length - 1
    )
  ];
};

export const isDowngradePlan = ({
  currentPlan,
  newPlan,
}: {
  currentPlan: string;
  newPlan: string;
}) => {
  const currentPlanIndex = Plans.findIndex(
    (p) => p.name.toLowerCase() === currentPlan.toLowerCase()
  );
  const newPlanIndex = Plans.findIndex(
    (p) => p.name.toLowerCase() === newPlan.toLowerCase()
  );
  return newPlanIndex < currentPlanIndex;
};

export const getSuggestedPlan = ({
  suggestFree = false,
}: {
  suggestFree?: boolean;
}): { plan: PlanDetails } => {
  for (const plan of Plans) {
    // Skip free plan unless explicitly requested
    if (!suggestFree && plan.price.monthly === 0) continue;

    // Return the first matching plan
    return { plan };
  }

  // Fallback to Pro plan (should never reach here)
  return { plan: Pro_Plan };
};

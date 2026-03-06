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

const FREE_PRICE_IDS = [
  "price_1T7KZbL2qfTOZYhO1MaFLeBn" /* monthly */,
  "price_1T7KZbL2qfTOZYhO1MaFLeBn" /* yearly */,
];

const PRO_PRICE_IDS = [
  "price_1SyWkFL2qfTOZYhOGhm9Gng2" /* monthly */,
  "price_1SyWkuL2qfTOZYhOePbSLGUt" /* yearly */,
];

const BUSINESS_PRICE_IDS = [
  "price_1SyWlbL2qfTOZYhO65SoPBvN" /* monthly */,
  "price_1SyWm7L2qfTOZYhO2yPVffKh" /* yearly */,
];

const ADVANCED_PRICE_IDS = [
  "price_1SyWnQL2qfTOZYhOLtZW3JrI" /* monthly */,
  "price_1SyWnuL2qfTOZYhOpnexxOsm" /* yearly */,
];

export const PLANS: PlanDetails[] = [
  {
    name: "Free",
    price: { monthly: 0, yearly: 0, ids: FREE_PRICE_IDS },
    limits: { users: 1 },
    featureTitle: "Includes:",
    features: [
      { id: "workspaces", name: "1 workspace" },
      { id: "users", name: "1 team member" },
      { id: "api", name: "API access with 100/min rate limit" },
    ],
  },
  {
    name: "Pro",
    price: { monthly: 30, yearly: 25, ids: PRO_PRICE_IDS },
    limits: { users: 3 },
    featureTitle: "Everything in free +",
    features: [
      { id: "workspaces", name: "2 workspaces" },
      { id: "users", name: "3 team members" },
      { id: "api", name: "API access with 600/min rate limit" },
      { id: "sso", name: "SSO enabled" },
      { id: "webhooks", name: "Enable webhook events" },
    ],
  },
  {
    name: "Business",
    price: { monthly: 90, yearly: 75, ids: BUSINESS_PRICE_IDS },
    limits: { users: 10 },
    featureTitle: "Everything in Pro +",
    features: [
      { id: "workspaces", name: "5 workspaces" },
      { id: "users", name: "10 team members" },
      { id: "api", name: "API access with 800/min rate limit" },
      { id: "sso", name: "SSO enabled" },
      { id: "webhooks", name: "Enable webhook events" },
    ],
  },
  {
    name: "Advanced",
    price: { monthly: 200, yearly: 175, ids: ADVANCED_PRICE_IDS },
    limits: { users: 25 },
    featureTitle: "Everything in Business +",
    features: [
      { id: "workspaces", name: "10 workspaces" },
      { id: "users", name: "50 team members" },
      { id: "api", name: "API access with 600/min rate limit" },
      { id: "sso", name: "SSO enabled" },
      { id: "webhooks", name: "Enable webhook events" },
    ],
  },
  {
    name: "Enterprise",
    price: { monthly: null, yearly: null },
    limits: { users: 100 },
    featureTitle: "Everything in Advanced +",
    features: [
      { id: "workspaces", name: "Unlimited workspaces" },
      { id: "users", name: "Unlimited team members" },
      { id: "api", name: "Unlimited API access" },
      { id: "sso", name: "SSO enabled" },
      { id: "webhooks", name: "Enable webhook events" },
    ],
  },
];

export const Free_Plan = PLANS.find((plan) => plan.name === "Free")!;
export const Pro_Plan = PLANS.find((plan) => plan.name === "Pro")!;
export const Business_Plan = PLANS.find((plan) => plan.name === "Business")!;
export const Advanced_Plan = PLANS.find((plan) => plan.name === "Advanced")!;
export const Enterprise_Plan = PLANS.find(
  (plan) => plan.name === "Enterprise"
)!;

export const getPlanFromPriceId = ({
  priceId,
}: {
  priceId: string;
}): { plan: PlanDetails | null } => {
  const planDetails = PLANS.find((plan) => plan.price.ids?.includes(priceId));
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
  const planDetails = PLANS.find(
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
  return PLANS[
    Math.min(
      PLANS.findIndex((p) => p.name.toLowerCase() === currentPlan) + 1,
      PLANS.length - 1
    )
  ];
};

export const isDowngradePlan = ({
  currentPlan,
  newPlan,
  currentTier,
  newTier,
}: {
  currentPlan: string;
  newPlan: string;
  currentTier?: number;
  newTier?: number;
}) => {
  const currentPlanIndex = PLANS.findIndex(
    (p) => p.name.toLowerCase() === currentPlan.toLowerCase()
  );
  const newPlanIndex = PLANS.findIndex(
    (p) => p.name.toLowerCase() === newPlan.toLowerCase()
  );
  return (
    currentPlanIndex > newPlanIndex ||
    (currentPlanIndex === newPlanIndex && (currentTier ?? 1) > (newTier ?? 1))
  );
};


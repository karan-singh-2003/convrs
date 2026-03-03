export type PlanFeature = {
    name: string;
}
export type CurrencyCode = "INR" | "USD";

export type RegionalPrice = {
    currency: CurrencyCode;
    monthly: number | "custom";
    yearly: number | "custom";
};
export type PlanDetails = {
    id: number;
    name: string;
    prices: RegionalPrice[];
    description?: string;
    features?: PlanFeature[]
    category?: string;
        featureLine?: string;
}

export const PLANS: PlanDetails[] = [
    {
        id: 1,
        name: "Trust",
        category:"Free",
        description: "No credit card required",
                featureLine:"Key features ",
        prices: [
            {
                currency: "INR",
                monthly: 0,
                yearly: 0,
            },
            {
                currency: "USD",
                monthly: 0,
                yearly: 0,
            },
        ],
        features: [
            {
                name: "Includes 1 user"
            },
            {
                name: "2% Per Booking"
            },
            {
                name: "Up to 50 Package Bookings / Month"
            },
        ]
    },
    {
        id: 2,
        name: " Pro",
        category:"Pro",
                featureLine:"Everything in Free, plus:",
  description: "Make your competition sweat",
        prices: [
            {
                currency: "INR",
                monthly: 80000,
                yearly: 60000
            },
            {
                currency: "USD",
                monthly: 200,
                yearly: 1000
            }
        ],
        features: [
            {
                name: "upto 10 users"
            },
            {
                name: "2% Per Booking"
            },
            {
                name: "Unlimited Package Bookings"
            },
        ]
    }, {
        id: 3,
        name: "Enterprise",
        category:"Enterprise",
        description: "Self-serve answers at scale",
        featureLine:"Everything in Pro, plus:",
        features:[
            {
                name: "Custom Requirements"
            },
        ],
        prices: [
            {
                currency: "INR",
                monthly: "custom",
                yearly: "custom"
            },
            {
                currency: "USD",
                monthly: "custom",
                yearly: "custom"
            }
        ]
    }
]


export function resolvePrice(
    plan: PlanDetails,
    billing: "monthly" | "yearly",
    currency: CurrencyCode
) {
    const regional = plan.prices.find(p => p.currency === currency);

    if (!regional) {
        throw new Error(`Pricing not configured for ${currency}`);
    }

    return regional[billing];
}

export function formatPrice(amount: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
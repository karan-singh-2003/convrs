// /**
//  * packages/utils/src/pricing.ts
//  */

// export type PlanFeatures = {
//   id: string;
//   name: string;
// };

// export type PlanDetails = {
//   name: string;
//   price: {
//     monthly: number | null;
//     yearly: number | null;
//     ids?: {
//       monthly: string;
//       yearly: string;
//     };
//   };
//   limits: {
//     events: number;
//   };
//   featureTitle?: string;
//   features?: PlanFeatures[];
// };

// // ─── Dodo testing Product IDs ─────────────────────────────────────────────────────────

// // const PRODUCT_IDS = {
// //   starter: {
// //     monthly: "pdt_0NdQZEKYFbEhiC2G1iuxI",
// //     yearly:  "pdt_0NdQZKlr1ulxmSL4H2pLm",
// //   },
// //   basic: {
// //     monthly: "pdt_0Ne6T12o5m5JRQ3dxIC9c",
// //     yearly:  "pdt_0Ne6T7wV7CK2jcSgL1tQ5",
// //   },
// //   pro: {
// //     monthly: "pdt_0NdQZe5tfdWWGVyBbEzMC",
// //     yearly:  "pdt_0NdQZj9gYH2urESRYKdbd",
// //   },
// //   growth: {
// //     monthly: "pdt_0NdQZocJrfVDBby2RMhs4",
// //     yearly:  "pdt_0NdQdnhULy6GydM4QmtWs",
// //   },
// //   business: {
// //     monthly: "pdt_0NdQZvCbP0tQpbhnmUTIp",
// //     yearly:  "pdt_0NdQa4CQrqsCFvt9B3dhH",
// //   },
// //   scale: {
// //     monthly: "pdt_0NdQa8Vc6T6NGnVx2DfPd",
// //     yearly:  "pdt_0NdQaDEbN58MSda9aDwwt",
// //   },
// //   pro_plus: {
// //     monthly: "pdt_0NdQaHQ5se9vGGkR44nds",
// //     yearly:  "pdt_0NdQaNTXSjo8UlZYx9ga5",
// //   },
// //   enterprise: {
// //     monthly: "pdt_0Ne6UOmg3pCcJljShHRP1",
// //     yearly:  "pdt_0Ne6UJ3vHbjeY1J1613hD",
// //   },
// //   ultimate: {
// //     monthly: "pdt_0Ne6UbBxxmN9VJ2SRLUfN",
// //     yearly:  "pdt_0Ne6UXcHfmTprzFe5905p",
// //   },
// // } as const;


// // prodcution pricing ids
// const PRODUCT_IDS = {
//   starter: {
//     monthly: "pdt_0NiLtXHVn7qIbuSApa1CC", // 10K Events
//     yearly: "pdt_0NiLtWsbcVuqlRyhHtTzy",
//   },
//   basic: {
//     monthly: "pdt_0NiLtWB8q7cdPiloC3TSS", // 25K Events
//     yearly: "pdt_0NiLtWYJkCIvrsH9XHuXX",
//   },
//   pro: {
//     monthly: "pdt_0NiLtBPEZgwM3avEYH8f0", // 100K Events
//     yearly: "pdt_0NiLtVnipCBTJUqRqwmK4",
//   },
//   growth: {
//     monthly: "pdt_0NiLtVYKgLhikplp5jgfC", // 500K Events
//     yearly: "pdt_0NiLtV8V3pnqd5sUE6pMK",
//   },
//   business: {
//     monthly: "pdt_0NiLtUdYuBeLpqQnksJmP", // 1M Events
//     yearly: "pdt_0NiLtTPArf4ImG9HzbqMo",
//   },
//   scale: {
//     monthly: "pdt_0NiLtT6RjBPWSsCI5H5X4", // 5M Events
//     yearly: "pdt_0NiLtAirntr5Ej5KQTQFf",
//   },
//   pro_plus: {
//     monthly: "pdt_0NiLtSllfCPniyzeMunga", // 10M Events
//     yearly: "pdt_0NiLtSU9GnqmyK9fbL68W",
//   },
//   enterprise: {
//     monthly: "pdt_0NiLtCiIkLK6mQ2EpFDGN", // 15M Events
//     yearly: "pdt_0NiLtDXtOCPsj4kyuMksX",
//   },
//   ultimate: {
//     monthly: "pdt_0NiLtCDmHaCr0ZQ3CIDFZ", // 25M Events
//     yearly: "pdt_0NiLtBokX11QHoqjpUDAf",
//   },
// } as const;

// // ─── Common features ──────────────────────────────────────────────────────────

// const CORE_FEATURES: PlanFeatures[] = [
//   { id: "analytics", name: "Full analytics dashboard" },
//   { id: "api", name: "API access" },
//   { id: "webhooks", name: "Webhook events" },
//   { id: "export", name: "Data export" },
//   { id: "support", name: "Email support" },
//   { id: "realtime", name: "Real-time event tracking" },
//   { id: "retention", name: "90-day data retention" },
// ];

// // ─── Plans ────────────────────────────────────────────────────────────────────

// export const PLANS: PlanDetails[] = [
//   {
//     name: "Starter",
//     price: { monthly: 9, yearly: 84, ids: PRODUCT_IDS.starter },
//     limits: { events: 10_000 },
//     featureTitle: "Includes:",
//     features: CORE_FEATURES,
//   },
//   {
//     name: "Basic",
//     price: { monthly: 24, yearly: 230, ids: PRODUCT_IDS.basic },
//     limits: { events: 25_000 },
//     featureTitle: "Everything in Starter +",
//     features: CORE_FEATURES,
//   },
//   {
//     name: "Pro",
//     price: { monthly: 48, yearly: 461, ids: PRODUCT_IDS.pro },
//     limits: { events: 100_000 },
//     featureTitle: "Everything in Basic +",
//     features: CORE_FEATURES,
//   },
//   {
//     name: "Growth",
//     price: { monthly: 79, yearly: 758, ids: PRODUCT_IDS.growth },
//     limits: { events: 500_000 },
//     featureTitle: "Everything in Pro +",
//     features: CORE_FEATURES,
//   },
//   {
//     name: "Business",
//     price: { monthly: 149, yearly: 1_430, ids: PRODUCT_IDS.business },
//     limits: { events: 1_000_000 },
//     featureTitle: "Everything in Growth +",
//     features: CORE_FEATURES,
//   },
//   {
//     name: "Scale",
//     price: { monthly: 249, yearly: 2_390, ids: PRODUCT_IDS.scale },
//     limits: { events: 5_000_000 },
//     featureTitle: "Everything in Business +",
//     features: CORE_FEATURES,
//   },
//   {
//     name: "Pro Plus",
//     price: { monthly: 399, yearly: 3_830, ids: PRODUCT_IDS.pro_plus },
//     limits: { events: 10_000_000 },
//     featureTitle: "Everything in Scale +",
//     features: CORE_FEATURES,
//   },
//   {
//     name: "Enterprise",
//     price: { monthly: 569, yearly: 5_462, ids: PRODUCT_IDS.enterprise },
//     limits: { events: 15_000_000 },
//     featureTitle: "Everything in Pro Plus +",
//     features: CORE_FEATURES,
//   },
//   {
//     name: "Ultimate",
//     price: { monthly: 899, yearly: 8_630, ids: PRODUCT_IDS.ultimate },
//     limits: { events: 25_000_000 },
//     featureTitle: "Everything in Enterprise +",
//     features: CORE_FEATURES,
//   },
// ];

// // ─── Named exports ────────────────────────────────────────────────────────────

// export const Starter_Plan = PLANS[0];
// export const Basic_Plan = PLANS[1];
// export const Pro_Plan = PLANS[2];
// export const Growth_Plan = PLANS[3];
// export const Business_Plan = PLANS[4];
// export const Scale_Plan = PLANS[5];
// export const ProPlus_Plan = PLANS[6];
// export const Enterprise_Plan = PLANS[7];
// export const Ultimate_Plan = PLANS[8];

// export const SELF_SERVE_PLANS = PLANS;
// // ─── Helpers ──────────────────────────────────────────────────────────────────

// /**
//  * Find a plan AND billing interval from a Dodo product ID.
//  *
//  * Searches both ids.monthly and ids.yearly on every plan so webhook
//  * handlers can do a single lookup and know exactly what was purchased.
//  *
//  * Replaces getPlanFromPriceId — same call signature, richer return value.
//  */
// export const getPlanFromProductId = (
//   productId: string
// ): { plan: PlanDetails | null; interval: "monthly" | "yearly" | null } => {
//   for (const plan of PLANS) {
//     if (!plan.price.ids) continue;
//     if (plan.price.ids.monthly === productId) return { plan, interval: "monthly" };
//     if (plan.price.ids.yearly === productId) return { plan, interval: "yearly" };
//   }
//   return { plan: null, interval: null };
// };

// /** Find a plan by name (case-insensitive). */
// export const getPlanDetails = ({
//   plan,
// }: {
//   plan: string;
// }): { plan: PlanDetails | null } => {
//   const found = PLANS.find((p) => p.name.toLowerCase() === plan.toLowerCase());
//   return { plan: found ?? null };
// };

// /**
//  * Get the correct Dodo product ID for a plan + billing interval.
//  * Used in the upgrade route when creating a checkout session or changing plan.
//  */
// export const getProductId = ({
//   planName,
//   interval,
// }: {
//   planName: string;
//   interval: "monthly" | "yearly";
// }): string | null => {
//   const { plan } = getPlanDetails({ plan: planName });
//   if (!plan?.price.ids) return null;
//   return plan.price.ids[interval];
// };

// /** Get the next plan up from the current one. Returns last plan if already at top. */
// export const getNextPlan = (planName?: string | null): PlanDetails => {
//   if (!planName) return Starter_Plan;
//   const idx = PLANS.findIndex(
//     (p) => p.name.toLowerCase() === planName.toLowerCase()
//   );
//   if (idx === -1) return Starter_Plan;
//   return PLANS[Math.min(idx + 1, PLANS.length - 1)];
// };

// /** Returns true if switching from currentPlan to newPlan is a downgrade. */
// export const isDowngradePlan = ({
//   currentPlan,
//   newPlan,
// }: {
//   currentPlan: string;
//   newPlan: string;
// }): boolean => {
//   const currentIdx = PLANS.findIndex(
//     (p) => p.name.toLowerCase() === currentPlan.toLowerCase()
//   );
//   const newIdx = PLANS.findIndex(
//     (p) => p.name.toLowerCase() === newPlan.toLowerCase()
//   );
//   return newIdx < currentIdx;
// };

// /** Format event limit for display (e.g. 1_000_000 → "1M events/mo"). */
// export const formatEventLimit = (events: number): string => {
//   if (events >= 1_000_000) return `${events / 1_000_000}M events/mo`;
//   if (events >= 1_000) return `${events / 1_000}K events/mo`;
//   return `${events} events/mo`;
// };

// /**
//  * @deprecated Use getPlanFromProductId instead.
//  * Kept so any remaining call-sites don't break at compile time.
//  */
// export const getPlanFromPriceId = getPlanFromProductId as unknown as (args: {
//   priceId: string;
// }) => { plan: PlanDetails | null; interval: "monthly" | "yearly" | null };



// ------------------------------------------------------------------------------------
// -------------------------------------version 2--------------------------------------
// ------------------------------------------------------------------------------------


/**
 * packages/utils/src/pricing.ts
 *
 * Two pricing FAMILIES now exist, each with the same event-tier ladder:
 *   - "standard": your original pricing (unchanged product IDs/prices)
 *   - "growth":   same tiers, higher price, unlocks X/Reddit attribution
 *
 * NAMING COLLISION WARNING: the Standard family already has a tier named
 * "Growth" (500K events, exported as Growth_Plan below). That tier name and
 * the new "growth" FAMILY are two different axes that happen to share a
 * word. A workspace can be on "Growth tier, Standard family" or "Growth
 * tier, Growth family" — always log/display BOTH `plan` and `planFamily`
 * together, never `plan` alone, or these two are indistinguishable in
 * anything but the DB. Strongly consider renaming the family (e.g. to
 * "attribution" or "pro") before this ships broadly.
 */

export type PricingFamily = "standard" | "growth";

export type PlanFeatures = {
  id: string;
  name: string;
};

export type PlanDetails = {
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
    events: number;
  };
  /** Drives feature-gating — see lib/billing/entitlements.ts */
  unlocksSocialAttribution: boolean;
  featureTitle?: string;
  features?: PlanFeatures[];
};

// ─── Standard family — Dodo product IDs (unchanged from before) ──────────────

// const STANDARD_PRODUCT_IDS = {
//   starter: {
//     monthly: "pdt_0NiLtXHVn7qIbuSApa1CC", // 10K Events
//     yearly: "pdt_0NiLtWsbcVuqlRyhHtTzy",
//   },
//   basic: {
//     monthly: "pdt_0NiLtWB8q7cdPiloC3TSS", // 25K Events
//     yearly: "pdt_0NiLtWYJkCIvrsH9XHuXX",
//   },
//   pro: {
//     monthly: "pdt_0NiLtBPEZgwM3avEYH8f0", // 100K Events
//     yearly: "pdt_0NiLtVnipCBTJUqRqwmK4",
//   },
//   growth: {
//     monthly: "pdt_0NiLtVYKgLhikplp5jgfC", // 500K Events
//     yearly: "pdt_0NiLtV8V3pnqd5sUE6pMK",
//   },
//   business: {
//     monthly: "pdt_0NiLtUdYuBeLpqQnksJmP", // 1M Events
//     yearly: "pdt_0NiLtTPArf4ImG9HzbqMo",
//   },
//   scale: {
//     monthly: "pdt_0NiLtT6RjBPWSsCI5H5X4", // 5M Events
//     yearly: "pdt_0NiLtAirntr5Ej5KQTQFf",
//   },
//   pro_plus: {
//     monthly: "pdt_0NiLtSllfCPniyzeMunga", // 10M Events
//     yearly: "pdt_0NiLtSU9GnqmyK9fbL68W",
//   },
//   enterprise: {
//     monthly: "pdt_0NiLtCiIkLK6mQ2EpFDGN", // 15M Events
//     yearly: "pdt_0NiLtDXtOCPsj4kyuMksX",
//   },
//   ultimate: {
//     monthly: "pdt_0NiLtCDmHaCr0ZQ3CIDFZ", // 25M Events
//     yearly: "pdt_0NiLtBokX11QHoqjpUDAf",
//   },
// } as const;


// prodution 
const STANDARD_PRODUCT_IDS = {
  starter: {
    monthly: "pdt_0NiLtXHVn7qIbuSApa1CC", // 10K Events
    yearly: "pdt_0NiLtWsbcVuqlRyhHtTzy",
  },
  basic: {
    monthly: "pdt_0NiLtWB8q7cdPiloC3TSS", // 25K Events
    yearly: "pdt_0NiLtWYJkCIvrsH9XHuXX",
  },
  pro: {
    monthly: "pdt_0NiLtBPEZgwM3avEYH8f0", // 100K Events
    yearly: "pdt_0NiLtVnipCBTJUqRqwmK4",
  },
  growth: {
    monthly: "pdt_0NiLtVYKgLhikplp5jgfC", // 500K Events
    yearly: "pdt_0NiLtV8V3pnqd5sUE6pMK",
  },
  business: {
    monthly: "pdt_0NiLtUdYuBeLpqQnksJmP", // 1M Events
    yearly: "pdt_0NiLtTPArf4ImG9HzbqMo",
  },
  scale: {
    monthly: "pdt_0NiLtT6RjBPWSsCI5H5X4", // 5M Events
    yearly: "pdt_0NiLtAirntr5Ej5KQTQFf",
  },
  pro_plus: {
    monthly: "pdt_0NiLtSllfCPniyzeMunga", // 10M Events
    yearly: "pdt_0NiLtSU9GnqmyK9fbL68W",
  },
  enterprise: {
    monthly: "pdt_0NiLtCiIkLK6mQ2EpFDGN", // 15M Events
    yearly: "pdt_0NiLtDXtOCPsj4kyuMksX",
  },
  ultimate: {
    monthly: "pdt_0NiLtCDmHaCr0ZQ3CIDFZ", // 25M Events
    yearly: "pdt_0NiLtBokX11QHoqjpUDAf",
  },
} as const;

// ─── Growth family — PLACEHOLDER product IDs ─────────────────────────────────
// You must create 9 new subscription products in the Dodo dashboard (one per
// tier x monthly/yearly = 18 products) and paste the real IDs in here before
// this family can actually be purchased. Checkout will fail with "Invalid
// plan" until these are replaced.

// const GROWTH_PRODUCT_IDS = {
//   starter: {
//     monthly: "pdt_0NkMZfj9YP0AoZv8kBUUu", // 10K Events
//     yearly: "pdt_0NkMZxGEsgd2vhFoTfteD",
//   },
//   basic: {
//     monthly: "pdt_0NkMaN7eVN138J2NP269H", // 25K Events
//     yearly: "pdt_0NkMaSyfV0OtgOWttVTwR",
//   },
//   pro: {
//     monthly: "pdt_0NkMaZxwX5bRAJ1VOAk1e", // 100K Events
//     yearly: "pdt_0NkMaf2zFm7OJ5RMmPHCU",
//   },
//   growth: {
//     monthly: "pdt_0NkMak49hTAfWPqrSddoZ", // 500K Events
//     yearly: "pdt_0NkMapVdz97Z9sZ6fI2EY",
//   },
//   business: {
//     monthly: "pdt_0NkMauos3FvpOv97tOgmC", // 1M Events
//     yearly: "pdt_0NkMb1mCCzxefB3HpdBJZ",
//   },
//   scale: {
//     monthly: "pdt_0NkMb7nSX5hJs9BiH4dGB", // 5M Events
//     yearly: "pdt_0NkMbCNluetTK6Ulm7Gug",
//   },
//   pro_plus: {
//     monthly: "pdt_0NkMbI7P6EZ60LfKy03b4", // 10M Events
//     yearly: "pdt_0NkMbQPDoU5hLVYdq310V",
//   },
//   enterprise: {
//     monthly: "pdt_0NkMbZC3BjYTHKQHEZzQ1", // 15M Events
//     yearly: "pdt_0NkMbeEgGKAwfUZrlgpwT",
//   },
//   ultimate: {
//     monthly: "pdt_0NkMbjyUm7juHFCLCigTU", // 25M Events
//     yearly: "pdt_0NkMboY14l0UVQTG9lDdN",
//   },
// } as const;


// production
const GROWTH_PRODUCT_IDS = {
  starter: {
    monthly: "pdt_0NkjC6vB9KUDcyrVeDveY", // 10K Events
    yearly: "pdt_0NkjC6JxCfsKnsfw9fx0B",
  },
  basic: {
    monthly: "pdt_0NkjC5aIR8X8DeYSnTQUQ", // 25K Events
    yearly: "pdt_0NkjC4qjj4GUVPh8BlUMU",
  },
  pro: {
    monthly: "pdt_0NkjC44HFDPmMIbIkdUP4", // 100K Events
    yearly: "pdt_0NkjC3Tr6xYavmReD19ym",
  },
  growth: {
    monthly: "pdt_0NkjC2qt7gKqvfP4uua4b", // 500K Events
    yearly: "pdt_0NkjC1xzjk6q6IWzzkaXZ",
  },
  business: {
    monthly: "pdt_0NkjBzUFD3kTvDcrjlmyO", // 1M Events
    yearly: "pdt_0NkjByzAlGBN3WWbRbmbb",
  },
  scale: {
    monthly: "pdt_0NkjByTf7I9MEQRiFuPKY", // 5M Events
    yearly: "pdt_0NkjBxusEe1mGW2q4z6Rk",
  },
  pro_plus: {
    monthly: "pdt_0NkjBxBYdb9cKJ9RFSezl", // 10M Events
    yearly: "pdt_0NkjBwWiJNlThqEO6LEZn",
  },
  enterprise: {
    monthly: "pdt_0NkjBvx33Cswkxh5j77aU", // 15M Events
    yearly: "pdt_0NkjBvStDjoWByY1cwz4A",
  },
  ultimate: {
    monthly: "pdt_0NkjBueZA9NnBBeKt4FCe", // 25M Events
    yearly: "pdt_0NkjBtgwbwHKcqeAKYuTs",
  },
} as const;
// ─── Shared feature lists ─────────────────────────────────────────────────────

const CORE_FEATURES: PlanFeatures[] = [
  { id: "analytics", name: "Full analytics dashboard" },
  { id: "api", name: "API access" },
  { id: "webhooks", name: "Webhook events" },
  { id: "export", name: "Data export" },
  { id: "support", name: "Email support" },
  { id: "realtime", name: "Real-time event tracking" },
  { id: "retention", name: "90-day data retention" },
];

const GROWTH_FEATURES: PlanFeatures[] = [
  ...CORE_FEATURES,
  { id: "social_attribution", name: "X/Reddit link attribution & mentions" },
];

// ─── Standard family plans (prices unchanged) ────────────────────────────────

export const STANDARD_PLANS: PlanDetails[] = [
  {
    name: "Starter",
    family: "standard",
    price: { monthly: 9, yearly: 84, ids: STANDARD_PRODUCT_IDS.starter },
    limits: { events: 10_000 },
    unlocksSocialAttribution: false,
    featureTitle: "Includes:",
    features: CORE_FEATURES,
  },
  {
    name: "Basic",
    family: "standard",
    price: { monthly: 24, yearly: 230, ids: STANDARD_PRODUCT_IDS.basic },
    limits: { events: 25_000 },
    unlocksSocialAttribution: false,
    featureTitle: "Everything in Starter +",
    features: CORE_FEATURES,
  },
  {
    name: "Pro",
    family: "standard",
    price: { monthly: 48, yearly: 461, ids: STANDARD_PRODUCT_IDS.pro },
    limits: { events: 100_000 },
    unlocksSocialAttribution: false,
    featureTitle: "Everything in Basic +",
    features: CORE_FEATURES,
  },
  {
    name: "Growth", // tier name — see collision warning at top of file
    family: "standard",
    price: { monthly: 79, yearly: 758, ids: STANDARD_PRODUCT_IDS.growth },
    limits: { events: 500_000 },
    unlocksSocialAttribution: false,
    featureTitle: "Everything in Pro +",
    features: CORE_FEATURES,
  },
  {
    name: "Business",
    family: "standard",
    price: { monthly: 149, yearly: 1_430, ids: STANDARD_PRODUCT_IDS.business },
    limits: { events: 1_000_000 },
    unlocksSocialAttribution: false,
    featureTitle: "Everything in Growth +",
    features: CORE_FEATURES,
  },
  {
    name: "Scale",
    family: "standard",
    price: { monthly: 249, yearly: 2_390, ids: STANDARD_PRODUCT_IDS.scale },
    limits: { events: 5_000_000 },
    unlocksSocialAttribution: false,
    featureTitle: "Everything in Business +",
    features: CORE_FEATURES,
  },
  {
    name: "Pro Plus",
    family: "standard",
    price: { monthly: 399, yearly: 3_830, ids: STANDARD_PRODUCT_IDS.pro_plus },
    limits: { events: 10_000_000 },
    unlocksSocialAttribution: false,
    featureTitle: "Everything in Scale +",
    features: CORE_FEATURES,
  },
  {
    name: "Enterprise",
    family: "standard",
    price: { monthly: 569, yearly: 5_462, ids: STANDARD_PRODUCT_IDS.enterprise },
    limits: { events: 15_000_000 },
    unlocksSocialAttribution: false,
    featureTitle: "Everything in Pro Plus +",
    features: CORE_FEATURES,
  },
  {
    name: "Ultimate",
    family: "standard",
    price: { monthly: 899, yearly: 8_630, ids: STANDARD_PRODUCT_IDS.ultimate },
    limits: { events: 25_000_000 },
    unlocksSocialAttribution: false,
    featureTitle: "Everything in Enterprise +",
    features: CORE_FEATURES,
  },
];

// ─── Growth family plans — same tiers, illustrative price deltas ─────────────
// Deltas roughly follow the "+$10 / +$20 / +$50" example given: small tiers
// +$10/mo, mid tiers +$20/mo, top tiers +$50/mo. Yearly delta uses the same
// ~20% annual discount the Standard family's own numbers imply. Adjust these
// to your real business model — they're placeholders, not a pricing strategy.

export const GROWTH_PLANS: PlanDetails[] = [
  {
    name: "Starter",
    family: "growth",
    price: { monthly: 19, yearly: 180, ids: GROWTH_PRODUCT_IDS.starter },
    limits: { events: 10_000 },
    unlocksSocialAttribution: true,
    featureTitle: "Everything in Standard Starter +",
    features: GROWTH_FEATURES,
  },
  {
    name: "Basic",
    family: "growth",
    price: { monthly: 34, yearly: 326, ids: GROWTH_PRODUCT_IDS.basic },
    limits: { events: 25_000 },
    unlocksSocialAttribution: true,
    featureTitle: "Everything in Standard Basic +",
    features: GROWTH_FEATURES,
  },
  {
    name: "Pro",
    family: "growth",
    price: { monthly: 68, yearly: 653, ids: GROWTH_PRODUCT_IDS.pro },
    limits: { events: 100_000 },
    unlocksSocialAttribution: true,
    featureTitle: "Everything in Standard Pro +",
    features: GROWTH_FEATURES,
  },
  {
    name: "Growth",
    family: "growth",
    price: { monthly: 99, yearly: 950, ids: GROWTH_PRODUCT_IDS.growth },
    limits: { events: 500_000 },
    unlocksSocialAttribution: true,
    featureTitle: "Everything in Standard Growth +",
    features: GROWTH_FEATURES,
  },
  {
    name: "Business",
    family: "growth",
    price: { monthly: 169, yearly: 1_622, ids: GROWTH_PRODUCT_IDS.business },
    limits: { events: 1_000_000 },
    unlocksSocialAttribution: true,
    featureTitle: "Everything in Standard Business +",
    features: GROWTH_FEATURES,
  },
  {
    name: "Scale",
    family: "growth",
    price: { monthly: 299, yearly: 2_870, ids: GROWTH_PRODUCT_IDS.scale },
    limits: { events: 5_000_000 },
    unlocksSocialAttribution: true,
    featureTitle: "Everything in Standard Scale +",
    features: GROWTH_FEATURES,
  },
  {
    name: "Pro Plus",
    family: "growth",
    price: { monthly: 449, yearly: 4_310, ids: GROWTH_PRODUCT_IDS.pro_plus },
    limits: { events: 10_000_000 },
    unlocksSocialAttribution: true,
    featureTitle: "Everything in Standard Pro Plus +",
    features: GROWTH_FEATURES,
  },
  {
    name: "Enterprise",
    family: "growth",
    price: { monthly: 619, yearly: 5_942, ids: GROWTH_PRODUCT_IDS.enterprise },
    limits: { events: 15_000_000 },
    unlocksSocialAttribution: true,
    featureTitle: "Everything in Standard Enterprise +",
    features: GROWTH_FEATURES,
  },
  {
    name: "Ultimate",
    family: "growth",
    price: { monthly: 949, yearly: 9_110, ids: GROWTH_PRODUCT_IDS.ultimate },
    limits: { events: 25_000_000 },
    unlocksSocialAttribution: true,
    featureTitle: "Everything in Standard Ultimate +",
    features: GROWTH_FEATURES,
  },
];

// ─── Family registry ──────────────────────────────────────────────────────────

export const PRICING_FAMILIES: Record<PricingFamily, PlanDetails[]> = {
  standard: STANDARD_PLANS,
  growth: GROWTH_PLANS,
};

const ALL_PLANS: PlanDetails[] = [...STANDARD_PLANS, ...GROWTH_PLANS];

/**
 * @deprecated Prefer PRICING_FAMILIES.standard / PRICING_FAMILIES.growth.
 * Kept for backward compatibility with existing call-sites that imported
 * PLANS expecting a flat array — now spans BOTH families, so tier names
 * (e.g. "starter") appear twice. Fine for enum validation (z.enum dedupes
 * naturally via Set below); NOT fine for any code assuming 1 entry per name.
 */
export const PLANS: PlanDetails[] = ALL_PLANS;

// ─── Backward-compatible named exports (Standard family only, as before) ────

export const Starter_Plan = STANDARD_PLANS[0];
export const Basic_Plan = STANDARD_PLANS[1];
export const Pro_Plan = STANDARD_PLANS[2];
export const Growth_Plan = STANDARD_PLANS[3]; // the TIER, not the family — see warning
export const Business_Plan = STANDARD_PLANS[4];
export const Scale_Plan = STANDARD_PLANS[5];
export const ProPlus_Plan = STANDARD_PLANS[6];
export const Enterprise_Plan = STANDARD_PLANS[7];
export const Ultimate_Plan = STANDARD_PLANS[8];

export const SELF_SERVE_PLANS = STANDARD_PLANS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find a plan, family, AND billing interval from a Dodo product ID.
 * Searches both ids.monthly/ids.yearly across BOTH families.
 */
export const getPlanFromProductId = (
  productId: string
): {
  plan: PlanDetails | null;
  interval: "monthly" | "yearly" | null;
  family: PricingFamily | null;
} => {
  for (const plan of ALL_PLANS) {
    if (!plan.price.ids) continue;
    if (plan.price.ids.monthly === productId) {
      return { plan, interval: "monthly", family: plan.family };
    }
    if (plan.price.ids.yearly === productId) {
      return { plan, interval: "yearly", family: plan.family };
    }
  }
  return { plan: null, interval: null, family: null };
};

/**
 * Find a plan by name WITHIN a specific family (case-insensitive).
 * Family defaults to "standard" for backward compatibility with call-sites
 * written before families existed — but plan tier names collide across
 * families, so anywhere you know the workspace's actual family, pass it.
 */
export const getPlanDetails = ({
  plan,
  family = "standard",
}: {
  plan: string;
  family?: PricingFamily;
}): { plan: PlanDetails | null } => {
  const found = PRICING_FAMILIES[family].find(
    (p) => p.name.toLowerCase() === plan.toLowerCase()
  );
  return { plan: found ?? null };
};

/**
 * Get the correct Dodo product ID for a plan + family + billing interval.
 */
export const getProductId = ({
  planName,
  family = "standard",
  interval,
}: {
  planName: string;
  family?: PricingFamily;
  interval: "monthly" | "yearly";
}): string | null => {
  const { plan } = getPlanDetails({ plan: planName, family });
  if (!plan?.price.ids) return null;
  return plan.price.ids[interval];
};

/** Get the next plan up within a family. Returns last plan if already at top. */
export const getNextPlan = (
  planName?: string | null,
  family: PricingFamily = "standard"
): PlanDetails => {
  const plans = PRICING_FAMILIES[family];
  if (!planName) return plans[0];
  const idx = plans.findIndex((p) => p.name.toLowerCase() === planName.toLowerCase());
  if (idx === -1) return plans[0];
  return plans[Math.min(idx + 1, plans.length - 1)];
};

/**
 * Returns true if switching from currentPlan to newPlan is a downgrade.
 *
 * REWRITTEN: was index-position-based, which only worked because there was
 * exactly one plan array. With two families sharing tier names, comparing
 * by array position is meaningless (index 3 in "standard" and index 3 in
 * "growth" aren't comparable tiers of the same ladder). Price is the only
 * cross-family-safe signal — a Growth-family plan always costs more than
 * its Standard-family counterpart, so switching families at "the same"
 * tier name correctly resolves as an upgrade, not a no-op or downgrade.
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
  return (next.price.monthly ?? 0) < (current.price.monthly ?? 0);
};

/** Format event limit for display (e.g. 1_000_000 → "1M events/mo"). */
export const formatEventLimit = (events: number): string => {
  if (events >= 1_000_000) return `${events / 1_000_000}M events/mo`;
  if (events >= 1_000) return `${events / 1_000}K events/mo`;
  return `${events} events/mo`;
};

/**
 * @deprecated Use getPlanFromProductId instead.
 * Kept so any remaining call-sites don't break at compile time.
 */
export const getPlanFromPriceId = getPlanFromProductId as unknown as (args: {
  priceId: string;
}) => { plan: PlanDetails | null; interval: "monthly" | "yearly" | null; family: PricingFamily | null };
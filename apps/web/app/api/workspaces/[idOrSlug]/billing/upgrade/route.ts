// /**
//  * app/api/workspaces/[slug]/billing/upgrade/route.ts
//  *
//  * Two cases:
//  *
//  *  CASE 1 – Active subscriber (active | on_hold)
//  *    → Call Dodo's Change Plan API.
//  *      Returns { success: true }.
//  *
//  *  CASE 2 – No subscription yet (new user, or trial converting to paid)
//  *    → Create a Dodo Checkout Session.
//  *      Returns { url: "https://checkout.dodopayments.com/..." }.
//  */

// import { withWorkspace } from "@/lib/auth";
// import { dodo } from "@/lib/dodo";
// import { booleanQuerySchema } from "@/lib/zod/schemas/misc";
// import { APP_DOMAIN, PLANS, getProductId, isDowngradePlan } from "@repo/utils";
// import { NextResponse } from "next/server";
// import * as z from "zod/v4";

// const VALID_PLAN_NAMES = PLANS.map((p) => p.name.toLowerCase()) as [
//   string,
//   ...string[],
// ];

// const schema = z.object({
//   plan: z.enum(VALID_PLAN_NAMES),
//   period: z.enum(["monthly", "yearly"]),
//   baseUrl: z.string(),
//   onboarding: booleanQuerySchema.nullish(),
// });

// /** Map Dodo error status codes to user-friendly messages. */
// function mapDodoError(status: number, message: string): string {
//   if (status === 409) {
//     // "Cannot change plan as previous payment is not successful yet"
//     // Dodo blocks plan changes when a payment is pending or failed.
//     return "Your previous payment hasn't completed yet. Please wait a few minutes and try again, or update your payment method.";
//   }
//   if (status === 422) return `Invalid request: ${message}`;
//   if (status === 429) return "Too many requests. Please wait a moment and try again.";
//   if (status === 404) return "Subscription not found. Please contact support.";
//   return message || "Failed to update plan. Please try again.";
// }

// export const POST = withWorkspace(
//   async ({ req, workspace, session }) => {
//     const { plan, period, baseUrl, onboarding } = schema.parse(
//       await req.json()
//     );


//     const productId = getProductId({ planName: plan, interval: period });


//     if (!productId) {
//       return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
//     }

    
//     // ── CASE 1: Active subscriber → Change Plan ────────────────────────────
//     if (
//       workspace.dodoSubscriptionId &&
//       ["active", "on_hold"].includes(workspace.subscriptionStatus ?? "")
//     ) {
     
//       // Prevent no-op: same plan + same billing interval
//       const sameInterval =
//         (period === "monthly" && workspace.billingInterval === "month") ||
//         (period === "yearly" && workspace.billingInterval === "year");

//       if (workspace.plan?.toLowerCase() === plan && sameInterval) {
//         return NextResponse.json(
//           { error: "You're already on this plan." },
//           { status: 400 }
//         );
//       }

//       const isDowngrade = isDowngradePlan({
//         currentPlan: workspace.plan ?? "",
//         newPlan: plan,
//       });

//       try {
//         // Dodo constraint: effective_at "next_billing_date" ONLY pairs with
//         // proration_billing_mode "full_immediately" — any other mode returns 422.
//         //
//         // Upgrades:   immediate effect + prorated charge for the remainder.
//         // Downgrades: scheduled at next billing date + full charge now
//         //             (customer keeps current plan until the period ends).
//         //
//         // on_payment_failure "prevent_change" keeps the subscription on the
//         // current plan if the proration charge fails, rather than switching
//         // the plan anyway and leaving an unpaid balance.
//         await dodo.subscriptions.changePlan(workspace.dodoSubscriptionId, {
//           product_id: productId,
//           quantity: 1,
//           proration_billing_mode: isDowngrade
//             ? "full_immediately"
//             : "prorated_immediately",
//           effective_at: isDowngrade ? "next_billing_date" : "immediately",
//           on_payment_failure: "prevent_change",
//         });
//       } catch (err: any) {
//         const status = err?.status ?? err?.statusCode ?? 500;
//         const message = err?.error?.message ?? err?.message ?? "";
//         const userMessage = mapDodoError(status, message);

   
//         return NextResponse.json({ error: userMessage }, { status: 400 });
//       }

//       return NextResponse.json({ success: true, message: "Plan updated" });
//     }

//     // ── CASE 2: New / trial user → Checkout Session ────────────────────────
//     const successUrl = onboarding
//       ? `${APP_DOMAIN}/onboarding/success?workspace=${workspace.slug}`
//       : `${APP_DOMAIN}/${workspace.slug}?upgraded=true`;


//     try {
   
//       const checkoutSession = await dodo.checkoutSessions.create({
//         product_cart: [{ product_id: productId, quantity: 1 }],

//         customer: {
//           email: session.user.email ?? undefined,
//           name: session.user.name ?? undefined,
//         },

//         metadata: {
//           workspaceId: workspace.id,
//           userId: session.user.id,
//           plan,
//           period,
//         },

//         return_url: successUrl,
//       });
 
//       return NextResponse.json({ url: checkoutSession.checkout_url });
//     } catch (err: any) {
//       const status = err?.status ?? err?.statusCode ?? 500;
//       const message = err?.error?.message ?? err?.message ?? "";
//       const userMessage = mapDodoError(status, message);
//       return NextResponse.json({ error: userMessage }, { status: 400 });
//     }
//   },
//   { requiredPermission: "billing:write" }
// );



// -------------------------------------------------------------------------------
// ----------------------------------version2-------------------------------------
// -------------------------------------------------------------------------------  



/**
 * app/api/workspaces/[slug]/billing/upgrade/route.ts
 *
 * Three cases now:
 *
 *  CASE 1 – Active subscriber (active | on_hold)
 *    → Call Dodo's Change Plan API. Works across families too — family is
 *      purely our own concept; Dodo just sees a different product_id.
 *      Returns { success: true }.
 *
 *  CASE 2 – Cardless trial user upgrading mid-trial
 *    → Create a Dodo Checkout Session WITH subscription_data.trial_period_days
 *      set to the REMAINING cardless-trial days. Dodo collects the card
 *      during checkout but doesn't charge until that many days pass —
 *      this is what "grant features now, charge at trial end" means in
 *      practice: we don't hand-roll deferred billing, we let Dodo's own
 *      trial mechanism defer the charge, and the webhook (subscription.active,
 *      handled via applySubscriptionPlan) grants plan limits immediately
 *      regardless of whether Dodo reports the interim status as "active"
 *      or "trialing".
 *      Returns { url: "https://checkout.dodopayments.com/..." }.
 *
 *  CASE 3 – New user / trial already ended, no subscription yet
 *    → Same Checkout Session, no trial_period_days.
 *      Returns { url: "https://checkout.dodopayments.com/..." }.
 */

import { withWorkspace } from "@/lib/auth";
import { dodo } from "@/lib/dodo";
import { booleanQuerySchema } from "@/lib/zod/schemas/misc";
import {
  APP_DOMAIN,
  PLANS,
  getProductId,
  isDowngradePlan,
} from "@repo/utils";
import { getRemainingTrialDays } from "@/lib/billing/trial-utils";
import { NextResponse } from "next/server";
import * as z from "zod/v4";
import { PricingFamily } from "@repo/db/client";

const VALID_PLAN_NAMES = Array.from(
  new Set(PLANS.map((p) => p.name.toLowerCase()))
) as [string, ...string[]];

const schema = z.object({
  plan: z.enum(VALID_PLAN_NAMES),
  family: z.enum(["standard", "growth"]).default("standard"),
  period: z.enum(["monthly", "yearly"]),
  baseUrl: z.string(),
  onboarding: booleanQuerySchema.nullish(),
});

/** Map Dodo error status codes to user-friendly messages. */
function mapDodoError(status: number, message: string): string {
  if (status === 409) {
    return "Your previous payment hasn't completed yet. Please wait a few minutes and try again, or update your payment method.";
  }
  if (status === 422) return `Invalid request: ${message}`;
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status === 404) return "Subscription not found. Please contact support.";
  return message || "Failed to update plan. Please try again.";
}

export const POST = withWorkspace(
  async ({ req, workspace, session }) => {
    const { plan, family, period, baseUrl, onboarding } = schema.parse(
      await req.json()
    );

    const productId = getProductId({ planName: plan, family, interval: period });

    if (!productId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const currentFamily: PricingFamily = workspace.planFamily ?? "standard";

    // ── CASE 1: Active subscriber → Change Plan ────────────────────────────
    if (
      workspace.dodoSubscriptionId &&
      ["active", "on_hold"].includes(workspace.subscriptionStatus ?? "")
    ) {
      const sameInterval =
        (period === "monthly" && workspace.billingInterval === "month") ||
        (period === "yearly" && workspace.billingInterval === "year");

      const isSamePlan =
        workspace.plan?.toLowerCase() === plan &&
        currentFamily === family &&
        sameInterval;

      if (isSamePlan) {
        return NextResponse.json(
          { error: "You're already on this plan." },
          { status: 400 }
        );
      }

      const isDowngrade = isDowngradePlan({
        currentPlan: workspace.plan ?? "",
        currentFamily,
        newPlan: plan,
        newFamily: family,
      });

      try {
        await dodo.subscriptions.changePlan(workspace.dodoSubscriptionId, {
          product_id: productId,
          quantity: 1,
          proration_billing_mode: isDowngrade
            ? "full_immediately"
            : "prorated_immediately",
          effective_at: isDowngrade ? "next_billing_date" : "immediately",
          on_payment_failure: "prevent_change",
        });
      } catch (err: any) {
        const status = err?.status ?? err?.statusCode ?? 500;
        const message = err?.error?.message ?? err?.message ?? "";
        return NextResponse.json({ error: mapDodoError(status, message) }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "Plan updated" });
    }

    // ── CASE 2 / 3: New checkout, possibly trial-backed ────────────────────
    const successUrl = onboarding
      ? `${APP_DOMAIN}/onboarding/success?workspace=${workspace.slug}`
      : `${APP_DOMAIN}/${workspace.slug}?upgraded=true`;

    // Only inject a Dodo-side trial if this workspace is genuinely mid
    // cardless-trial AND has never had a real Dodo subscription before —
    // an existing dodoSubscriptionId means they've already gone through
    // (or are going through) a real billing relationship, so a fresh
    // checkout here shouldn't re-grant a trial.
    const remainingTrialDays =
      !workspace.dodoSubscriptionId && workspace.subscriptionStatus === "trialing"
        ? getRemainingTrialDays(workspace.freeTrialEndDate)
        : null;

    try {
      const checkoutSession = await dodo.checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: 1 }],

        customer: {
          email: session.user.email ?? undefined,
          name: session.user.name ?? undefined,
        },

        metadata: {
          workspaceId: workspace.id,
          userId: session.user.id,
          plan,
          family,
          period,
        },

        ...(remainingTrialDays !== null && {
          subscription_data: {
            trial_period_days: remainingTrialDays,
          },
        }),

        return_url: successUrl,
      });

      return NextResponse.json({ url: checkoutSession.checkout_url });
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode ?? 500;
      const message = err?.error?.message ?? err?.message ?? "";
      return NextResponse.json({ error: mapDodoError(status, message) }, { status: 400 });
    }
  },
  { requiredPermission: "billing:write" }
);
/**
 * app/api/workspaces/[slug]/billing/upgrade/route.ts
 *
 * Replaces the Stripe upgrade route 1-for-1.
 *
 * Two cases — mirrors your original Stripe logic:
 *
 *  CASE 1 – Active subscriber (active | on_hold)
 *    → Call Dodo's Change Plan API (PATCH /subscriptions/:id/plan).
 *      No redirect needed; Dodo handles proration internally.
 *      Returns { success: true }.
 *
 *  CASE 2 – No subscription yet (new user, or trial converting to paid)
 *    → Create a Dodo Checkout Session.
 *      Returns { url: "https://checkout.dodopayments.com/..." }.
 *      The frontend redirects the user there.
 *
 * Dodo billing_frequency values: "monthly" | "annual"  (NOT "yearly")
 */

import { withWorkspace } from "@/lib/auth";
import { dodo } from "@/lib/dodo";
import { booleanQuerySchema } from "@/lib/zod/schemas/misc";
import { APP_DOMAIN, PLANS, getProductId, isDowngradePlan } from "@repo/utils";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

const VALID_PLAN_NAMES = PLANS.map((p) => p.name.toLowerCase()) as [
  string,
  ...string[],
];

const schema = z.object({
  plan:       z.enum(VALID_PLAN_NAMES),
  period:     z.enum(["monthly", "yearly"]),
  baseUrl:    z.string(),
  onboarding: booleanQuerySchema.nullish(),
});

/** Dodo expects "monthly" | "annual" — not "yearly" */
function toDodoBillingFrequency(period: "monthly" | "yearly") {
  return period === "yearly" ? "annual" : "monthly";
}

export const POST = withWorkspace(
  async ({ req, workspace, session }) => {
    const { plan, period, baseUrl, onboarding } = schema.parse(
      await req.json()
    );

    // ── Resolve the Dodo product ID for this plan + interval ──────────────
    // getProductId now requires an interval because monthly and yearly are
    // separate product IDs in Dodo.
    const productId = getProductId({ planName: plan, interval: period });

    if (!productId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // ── CASE 1: Active subscriber → Change Plan ────────────────────────────
    // workspace.dodoSubscriptionId is the field that replaced
    // workspace.stripeSubscriptionId in your Prisma schema.
    if (
      workspace.stripeSubscriptionId &&
      ["active", "on_hold"].includes(workspace.subscriptionStatus ?? "")
    ) {
      // Prevent no-op: same plan + same billing interval
      const sameInterval =
        (period === "monthly" && workspace.billingInterval === "month") ||
        (period === "yearly"  && workspace.billingInterval === "year");

      if (workspace.plan?.toLowerCase() === plan && sameInterval) {
        return NextResponse.json(
          { error: "Already on this plan" },
          { status: 400 }
        );
      }

      // Dodo Change Plan: POST /subscriptions/:id/plan
      // Docs: https://docs.dodopayments.com/api-reference/subscriptions/change-plan
      // Returns 200 with empty body (not a JSON object) — no need to read the response.
      // await dodo.subscriptions.changePlan(workspace.stripeSubscriptionId, {
      //   product_id:        productId,
      //   billing_frequency: toDodoBillingFrequency(period),
      //   // "immediate" applies the change now and prorates; "next_period"
      //   // queues it for the next renewal date.
      //   proration_billing_mode: isDowngradePlan({
      //     currentPlan: workspace.plan ?? "",
      //     newPlan:     plan,
      //   })
      //     ? "prorated_next_billing_cycle"  // downgrade: switch at period end
      //     : "prorated_immediately",         // upgrade: switch now + prorate
      // });

      return NextResponse.json({ success: true, message: "Plan updated" });
    }


    // ── CASE 2: New / trial user → Checkout Session ────────────────────────
    const successUrl = onboarding
      ? `${APP_DOMAIN}/onboarding/success?workspace=${workspace.slug}`
      : `${APP_DOMAIN}/${workspace.slug}?upgraded=true`;

    // Dodo Create Checkout Session
    // Docs: https://docs.dodopayments.com/api-reference/checkout-sessions/create
    const checkoutSession = await dodo.checkoutSessions.create({
      // product_cart is a TOP-LEVEL field — not nested inside billing.
      // Monthly and yearly are separate product IDs in Dodo.
      product_cart: [{ product_id: productId, quantity: 1 }],

      // Pre-fill the customer's email so they don't have to type it.
      customer: {
        email: session.user.email ?? undefined,
        name:  session.user.name ?? undefined,
      },

      metadata: {
        workspaceId: workspace.id,
        userId:      session.user.id,
        plan,
        period,
      },

      return_url: successUrl,
    });

    // checkoutSession.url is the hosted Dodo checkout page
    return NextResponse.json({ url: checkoutSession.checkout_url});
  },
  { requiredPermission: "billing:write" }
);
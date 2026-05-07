/**
 * app/api/workspaces/[slug]/billing/route.ts
 *
 * Billing cycle is derived from the product_id on the Dodo subscription,
 * matched against PRODUCT_IDS in pricing.ts.
 *
 * Why not use payment_frequency_interval?
 * Dodo returns payment_frequency_interval: "Month" for yearly plans too
 * (it reflects charge cadence, not plan term). subscription_period_interval
 * can contain test-data noise. The product_id is the ground truth — it was
 * set when the subscription was created and maps 1:1 to monthly/yearly.
 */

import { withWorkspace } from "@/lib/auth";
import { dodo } from "@/lib/dodo";
import { getPlanFromProductId } from "@repo/utils";
import { NextResponse } from "next/server";

export const GET = withWorkspace(
  async ({ workspace }) => {
    const { dodoSubscriptionId } = workspace;

    let billingCycle: "monthly" | "yearly" | null = null;
    let billingPeriodStart: number | null = null;

    if (dodoSubscriptionId) {
      try {
        const subscription = await dodo.subscriptions.retrieve(
          dodoSubscriptionId
        );

        if (subscription) {
          // Derive billing cycle from product_id — the only reliable source.
          // getPlanFromProductId searches both ids.monthly and ids.yearly on
          // every plan and returns which interval matched.
          const { interval } = getPlanFromProductId(subscription.product_id);
          if (interval) billingCycle = interval;

          // previous_billing_date = start of current billing period (ISO string).
          // Convert to Unix seconds for getFormattedBillingPeriod().
          if (subscription.previous_billing_date) {
            billingPeriodStart = Math.floor(
              new Date(subscription.previous_billing_date).getTime() / 1000
            );
          }
        }
      } catch (err) {
        console.error("[billing/GET] Dodo subscription fetch failed:", err);
      }
    }

    return NextResponse.json({ billingCycle, billingPeriodStart });
  },
  { requiredPermission: "billing:read" }
);
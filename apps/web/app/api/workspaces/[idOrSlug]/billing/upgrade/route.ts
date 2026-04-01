import { withWorkspace } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { booleanQuerySchema } from "@/lib/zod/schemas/misc";
import { APP_DOMAIN, PLANS } from "@repo/utils";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

const VALID_PLAN_NAMES = PLANS.map((p) => p.name.toLowerCase()) as [
  string,
  ...string[],
];

const schema = z.object({
  plan: z.enum(VALID_PLAN_NAMES),
  period: z.enum(["monthly", "yearly"]),
  baseUrl: z.string(),
  onboarding: booleanQuerySchema.nullish(),
});

export const POST = withWorkspace(
  async ({ req, workspace, session }) => {
    const { plan, period, baseUrl, onboarding } = schema.parse(
      await req.json()
    );

    // ─────────────────────────────
    // Resolve priceId
    // ─────────────────────────────
    const matchedPlan = PLANS.find((p) => p.name.toLowerCase() === plan);

    if (!matchedPlan?.price?.ids) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const priceId =
      period === "yearly"
        ? matchedPlan.price.ids.yearly
        : matchedPlan.price.ids.monthly;

    // ─────────────────────────────
    // Fetch existing subscription
    // ─────────────────────────────
    const existingSubscription = workspace.stripeSubscriptionId
      ? await stripe.subscriptions
          .retrieve(workspace.stripeSubscriptionId)
          .catch(() => null)
      : null;

    // ─────────────────────────────
    // CASE 1: User already paying → UPDATE
    // ─────────────────────────────
    if (
      existingSubscription &&
      ["active", "trialing", "past_due"].includes(existingSubscription.status)
    ) {
      const item = existingSubscription.items.data[0];

      if (item.price.id === priceId) {
        return NextResponse.json(
          { error: "Already on this plan" },
          { status: 400 }
        );
      }

      await stripe.subscriptions.update(existingSubscription.id, {
        items: [
          {
            id: item.id,
            price: priceId,
          },
        ],
        proration_behavior: "create_prorations",
        billing_cycle_anchor: "unchanged",
      });

      return NextResponse.json({
        success: true,
        message: "Subscription updated",
      });
    }

    // ─────────────────────────────
    // CASE 2: Trial user → Checkout
    // ─────────────────────────────

    const sessionCheckout = await stripe.checkout.sessions.create({
      mode: "subscription",

      client_reference_id: workspace.id,

      customer_email: session.user.email ?? undefined,

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      success_url: onboarding
        ? `${APP_DOMAIN}/onboarding/success?workspace=${workspace.slug}`
        : `${APP_DOMAIN}/${workspace.slug}?upgraded=true`,

      cancel_url: baseUrl,

      metadata: {
        workspaceId: workspace.id,
        userId: session.user.id,
        plan,
        period,
      },

      subscription_data: {
        metadata: {
          workspaceId: workspace.id,
          plan,
          period,
        },

        // Preserve remaining trial if exists
        ...(workspace.freeTrialEndDate && {
          trial_end: Math.floor(
            new Date(workspace.freeTrialEndDate).getTime() / 1000
          ),
        }),
      },

      allow_promotion_codes: true,
    });

    return NextResponse.json({
      url: sessionCheckout.url,
    });
  },
  { requiredPermission: "billing:write" }
);

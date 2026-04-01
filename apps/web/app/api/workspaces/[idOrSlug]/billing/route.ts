import { withWorkspace } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export const GET = withWorkspace(
  async ({ workspace }) => {
    const { stripeCustomerId } = workspace;

    let billingCycle: "monthly" | "yearly" | null = null;
    let billingPeriodStart: number | null = null;
    if (stripeCustomerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "all",
        limit: 1,
        expand: ["data.items.data.price"],
      });

      const subscription = subscriptions.data[0];

      if (subscription) {
        const interval = subscription.items.data[0].price.recurring?.interval;
        if (interval === "month") billingCycle = "monthly";
        if (interval === "year") billingCycle = "yearly";

        // Add this ↓
        billingPeriodStart = subscription.billing_cycle_anchor;
      }
    }

    return new Response(
      JSON.stringify({
        billingCycle,
        billingPeriodStart,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  },
  {
    requiredPermission: "billing:read",
  }
);

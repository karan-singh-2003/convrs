import { withWorkspace } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { APP_DOMAIN } from "@repo/utils";

export const POST = withWorkspace(
  async ({ workspace }) => {
    if (!workspace.stripeId) {
      return new Response(
        JSON.stringify({ error: "No Stripe customer found" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    try {
      const { url } = await stripe.billingPortal.sessions.create({
        customer: workspace.stripeId,
        return_url: `${APP_DOMAIN}/${workspace.slug}/settings/billing`,
      });
      return new Response(JSON.stringify({ url }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Failed to create billing portal session" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
  {
    requiredPermission: "billing:write",
  }
);

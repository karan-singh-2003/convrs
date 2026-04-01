import Stripe from "stripe";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { getPlanFromPriceId } from "@repo/utils";

export async function customerSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;

  const stripeSubscriptionId = subscription.id;

  const billingInterval =
    subscription.items.data[0]?.price?.recurring?.interval ?? null;

  const currentPeriodEnd =
    typeof subscription.items.data[0]?.current_period_end === "number"
      ? new Date(subscription.items.data[0].current_period_end * 1000)
      : null;

  const priceId = subscription.items.data[0]?.price?.id;
  const { plan } = priceId ? getPlanFromPriceId({ priceId }) : { plan: null };

  //  Find workspace by subscription (NOT customer)
  const workspace = await prisma.workspace.findFirst({
    where: { stripeSubscriptionId },
    select: {
      id: true,
      subscriptionStatus: true,
      freeTrialEndDate: true,
    },
  });

  if (!workspace) {
    return NextResponse.json({ received: true });
  }

  // Detect cancel at period end
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;
  const now = new Date();

  const isTrialActive =
    workspace.freeTrialEndDate &&
    workspace.freeTrialEndDate > now &&
    subscription.status === "trialing";

  const canApplyPlanLimits =
    !isTrialActive && ["active", "trialing"].includes(subscription.status);

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      subscriptionStatus: subscription.status,
      billingInterval,
      currentPeriodEnd,

      ...(canApplyPlanLimits &&
        plan && {
          plan: plan.name.toLowerCase(),
          tierEvents: plan.limits.events,
          usageLimit: plan.limits.events,
        }),

      // If user scheduled cancel → still active until period end
      ...(cancelAtPeriodEnd && {
        subscriptionStatus: "canceling",
      }),

      // Handle payment failure
      ...(subscription.status === "past_due" && {
        paymentFailedAt: new Date(),
      }),

      // If recovered from failure
      ...(["active", "trialing"].includes(subscription.status) && {
        paymentFailedAt: null,
      }),
    },
  });

  return NextResponse.json({ received: true });
}

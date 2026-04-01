import Stripe from "stripe";
import { prisma } from "@repo/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { getPlanFromPriceId } from "@repo/utils";

export async function customerSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;

  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId = subscription.customer.toString();

  const workspace = await prisma.workspace.findFirst({
    where: {
      stripeSubscriptionId,
    },
    select: {
      id: true,
      freeTrialEndDate: true,
    },
  });

  if (!workspace) {
    return NextResponse.json({ received: true });
  }

  //  Check if user has another active subscription
  const { data: activeSubscriptions } = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "active",
  });

  if (activeSubscriptions.length > 0) {
    const activeSub = activeSubscriptions[0] as Stripe.Subscription;
    const priceId = activeSub.items.data[0]?.price?.id;
    const { plan } = priceId ? getPlanFromPriceId({ priceId }) : { plan: null };

    if (!plan) {
      return NextResponse.json({ received: true });
    }

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        stripeSubscriptionId: activeSub.id,
        subscriptionStatus: activeSub.status,
        billingInterval: activeSub.items.data[0]?.price?.recurring?.interval,
        currentPeriodEnd:
          typeof activeSub.items.data[0]?.current_period_end === "number"
            ? new Date(activeSub.items.data[0].current_period_end * 1000)
            : null,
        plan: plan.name.toLowerCase(),
        tierEvents: plan.limits.events,
        usageLimit: plan.limits.events,
      },
    });

    return NextResponse.json({ received: true });
  }

  //  No active subscription → restrict access
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      stripeSubscriptionId: null,
      subscriptionStatus: "canceled",
      billingInterval: null,
      currentPeriodEnd: null,
      tierEvents: null,
      usageLimit: 0, // block usage
      paymentFailedAt: null,
    },
  });

  return NextResponse.json({ received: true });
}

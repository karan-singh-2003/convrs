import { getPlanFromPriceId } from "@repo/utils";
import Stripe from "stripe";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { updateWorkspacePlan } from "./utils/update-worksapce-plan";

export async function customerSubscriptionUpdated(event: Stripe.Event) {
  const subscriptionUpdated = event.data.object as Stripe.Subscription;
  const priceId = subscriptionUpdated.items.data[0].price.id;

  const { plan } = getPlanFromPriceId({ priceId });
  if (!plan) {
    console.log(
      `Invalid price ID in customer.subscription.updated event: ${priceId}`
    );
    return;
  }

  const stripeId = subscriptionUpdated.customer.toString();

  const workspace = await prisma.workspace.findUnique({
    where: { stripeId },
    select: {
      id: true,
      plan: true,
      paymentFailedAt: true,
      users: {
        select: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        where: {
          role: "owner",
        },
      },
    },
  });

  if (!workspace) {
    console.log(
      `workspace with stripeId ${stripeId} not found in the stripe webhook customer.subscription.updated event`
    );
    return NextResponse.json({ received: true });
  }

  await updateWorkspacePlan({
    workspace: {
      ...workspace,
      plan: workspace.plan ?? "free",
    },
    priceId,
  });

  const subscriptionCancelled =
    subscriptionUpdated.status === "active" &&
    subscriptionUpdated.cancel_at_period_end;
}

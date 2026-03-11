import Stripe from "stripe";
import { prisma } from "@repo/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { updateWorkspacePlan } from "./utils/update-worksapce-plan";
import { Free_Plan } from "@repo/utils";
export async function customerSubscriptionDeleted(event: Stripe.Event) {
  const subscriptionDeleted = event.data.object as Stripe.Subscription;

  const stripeId = subscriptionDeleted.customer.toString();

  const workspace = await prisma.workspace.findUnique({
    where: { stripeId },
    select: {
      id: true,
      slug: true,
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
   
    return NextResponse.json({ recieved: true });
  }

  const { data: activeSubscriptions } = await stripe.subscriptions.list({
    customer: stripeId,
    status: "active",
  });

  if (activeSubscriptions.length > 0) {
    const activeSubscription = activeSubscriptions[0];
    const priceId = activeSubscription.items.data[0].price.id;
    await updateWorkspacePlan({
      workspace: {
        ...workspace,
        plan: workspace.plan ?? "free",
      },
      priceId,
    });

    return NextResponse.json({ recieved: true });
  }

  const workspaceUsers = workspace.users.map(({ user }) => user);

  await Promise.allSettled([
    prisma.workspace.update({
      where: { stripeId },
      data: {
        plan: "free",
        userLimit: Free_Plan.limits.users,
        paymentFailedAt: null,
      },
    }),
  ]);
}

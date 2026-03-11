import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getPlanFromPriceId } from "@repo/utils";
import { prisma } from "@repo/db";
import { User } from "@repo/db/client";
import { WorkspaceProps } from "@/lib/types";
import { onboardingStepCache } from "@/lib/workspaces/omboarding-step-cache";

import UpgradeEmail from "@repo/email/templates/upgrade-email";
import { sendBatchEmail } from "@repo/email";

export async function checkoutSessionCompleted(event: Stripe.Event) {
  const checkoutSession = event.data.object as Stripe.Checkout.Session;

  if (checkoutSession.mode === "setup") {
    return;
  }
  if (
    checkoutSession.client_reference_id == null ||
    checkoutSession.customer == null
  ) {

    return;
  }

  const subscription = await stripe.subscriptions.retrieve(
    checkoutSession.subscription as string
  );

  const priceId = subscription.items.data[0].price.id;

  const { plan } = getPlanFromPriceId({ priceId });

  if (!plan) {
   
    return;
  }

  const stripeId = checkoutSession.customer.toString();
  const workspaceId = checkoutSession.client_reference_id;
  const planName = plan.name.toLowerCase();

  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      stripeId,
      billingCycleStart: new Date().getDate(),
      plan: planName,
      userLimit: plan.limits.users,
    },
    select: {
      plan: true,
      users: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  const users = workspace.users.map(({ user }) => ({
    id: user.id,
    email: user.email,
    name: user.name,
  }));

  await Promise.allSettled([
    completeOnboarding({ workspaceId, users }),
    sendBatchEmail(
      users.map((user) => ({
        to: user.email!,
        subject: `Your workspace has been upgraded to ${plan.name} plan!`,
        react: UpgradeEmail({
          name: user.name!,
          plan: plan.name,
          email: user.email!,
        }),
      }))
    ),
  ]);
}

async function completeOnboarding({
  workspaceId,
  users,
}: {
  workspaceId: string;
  users: Pick<User, "id">[];
}) {
  const workspace = (await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      users: true,
    },
  })) as unknown as WorkspaceProps | null;

  if (!workspace) {
  
    return;
  }

  await Promise.allSettled([
    onboardingStepCache.mset({
      userIds: users.map(({ id }) => id),
      step: "completed",
    }),
  ]);
}

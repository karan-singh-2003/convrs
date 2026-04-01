import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@repo/db";
import { onboardingStepCache } from "@/lib/workspaces/omboarding-step-cache";
import UpgradeEmail from "@repo/email/templates/upgrade-email";
import { sendBatchEmail } from "@repo/email";
import { User } from "@repo/db/client";
import { WorkspaceProps } from "@/lib/types";
import { getPlanFromPriceId } from "@repo/utils";
import { NextResponse } from "next/server";

export async function checkoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  if (session.mode !== "subscription") {
    return NextResponse.json({ received: true });
  }

  if (!session.customer || !session.subscription) {
    return NextResponse.json({ received: true });
  }

  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  const workspaceId =
    session.client_reference_id ||
    session.metadata?.workspaceId ||
    subscription.metadata?.workspaceId;

  if (!workspaceId) {
    return NextResponse.json({ received: true });
  }

  const stripeCustomerId = session.customer.toString();

  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    return NextResponse.json({ received: true });
  }

  const { plan } = getPlanFromPriceId({ priceId });
  if (!plan) {
    return NextResponse.json({ received: true });
  }

  const billingInterval =
    subscription.items.data[0]?.price?.recurring?.interval ?? null;

  const currentPeriodEnd =
    typeof subscription.items.data[0]?.current_period_end === "number"
      ? new Date(subscription.items.data[0].current_period_end * 1000)
      : null;

  // const currentPeriodEnd =
  //   typeof subscription.current_period_end === "number"
  //     ? new Date(subscription.current_period_end * 1000)
  //     : null;

  //  Fetch existing workspace (for trial logic)
  const existingWorkspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      freeTrialEndDate: true,
    },
  });

  if (!existingWorkspace) {
    return NextResponse.json({ received: true });
  }

  const now = new Date();

  // Keep existing starter limits until trial actually ends.
  const isTrialActive =
    existingWorkspace.freeTrialEndDate &&
    existingWorkspace.freeTrialEndDate > now &&
    subscription.status === "trialing";

  const canApplyPlanLimits =
    !isTrialActive && ["active", "trialing"].includes(subscription.status);

  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      billingInterval,
      currentPeriodEnd,

      ...(canApplyPlanLimits && {
        plan: plan.name.toLowerCase(),
        tierEvents: plan.limits.events,
        usageLimit: plan.limits.events,
      }),
    },
    select: {
      users: {
        select: {
          user: {
            select: { id: true, name: true, email: true },
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

  const asyncTasks: Promise<unknown>[] = [
    completeOnboarding({ workspaceId, users }),
  ];

  if (canApplyPlanLimits) {
    asyncTasks.push(
      sendBatchEmail(
        users.map((user) => ({
          to: user.email!,
          subject: "Your workspace has been upgraded!",
          react: UpgradeEmail({
            name: user.name!,
            plan: plan.name,
            email: user.email!,
          }),
        }))
      )
    );
  }

  await Promise.allSettled(asyncTasks);

  return NextResponse.json({ received: true });
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
    include: { users: true },
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

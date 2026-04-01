import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { Starter_Plan } from "@repo/utils";

export const POST = withWorkspace(
  async ({ workspace }) => {
    const now = new Date();

    // Idempotent success when the workspace is already in an active trial.
    if (
      workspace.subscriptionStatus === "trialing" &&
      workspace.freeTrialEndDate &&
      workspace.freeTrialEndDate > now
    ) {
      return NextResponse.json({
        success: true,
        trialEndsAt: workspace.freeTrialEndDate.toISOString(),
      });
    }

    // Never allow converting a paid workspace into a local free trial state.
    if (
      workspace.stripeSubscriptionId ||
      workspace.subscriptionStatus === "active" ||
      workspace.subscriptionStatus === "past_due"
    ) {
      return NextResponse.json(
        { error: "Workspace already has an active subscription." },
        { status: 400 }
      );
    }

    // Allow trial only once.
    if (workspace.freeTrialEndDate) {
      return NextResponse.json(
        { error: "Free trial already used." },
        { status: 400 }
      );
    }

    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        subscriptionStatus: "trialing",
        freeTrialEndDate: trialEnd,
        currentPeriodEnd: trialEnd,

        // No Stripe objects during trial
        stripeCustomerId: null,
        stripeSubscriptionId: null,

        // Optional defaults
        plan: "starter",
        billingInterval: "month",
        tierEvents: Starter_Plan.limits.events,
        usageLimit: Starter_Plan.limits.events,
      },
    });

    return NextResponse.json({
      success: true,
      trialEndsAt: trialEnd.toISOString(),
    });
  },
  { requiredPermission: "billing:write" }
);

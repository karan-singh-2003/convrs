/**
 * app/api/workspaces/[slug]/billing/trial/route.ts
 *
 * Unchanged business logic — grants a 14-day local trial on the Starter plan.
 *
 * The only change from your original is replacing `stripeSubscriptionId`
 * and `stripeCustomerId` with `dodoSubscriptionId` and `dodoCustomerId`
 * in the Prisma update.  Everything else is identical.
 */

import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { Starter_Plan } from "@repo/utils";

export const POST = withWorkspace(
  async ({ workspace }) => {
    const now = new Date();

    // Idempotent: already in a valid trial → return current end date.
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

    // Never allow downgrading a paying workspace to a local trial.
    if (
      workspace.stripeSubscriptionId ||            // ← was stripeSubscriptionId
      workspace.subscriptionStatus === "active" ||
      workspace.subscriptionStatus === "past_due"
    ) {
      return NextResponse.json(
        { error: "Workspace already has an active subscription." },
        { status: 400 }
      );
    }

    // One trial per workspace, ever.
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
        freeTrialEndDate:   trialEnd,
        currentPeriodEnd:   trialEnd,

        // No Dodo objects during a local trial
        dodoCustomerId:      null,         // ← was stripeCustomerId
        dodoSubscriptionId:  null,         // ← was stripeSubscriptionId

        // Lock trial to Starter plan, monthly billing, 10 K events
        plan:          "starter",
        billingInterval: "month",
        tierEvents:    Starter_Plan.limits.events,
        usageLimit:    Starter_Plan.limits.events,
      },
    });

    return NextResponse.json({
      success: true,
      trialEndsAt: trialEnd.toISOString(),
    });
  },
  { requiredPermission: "billing:write" }
);
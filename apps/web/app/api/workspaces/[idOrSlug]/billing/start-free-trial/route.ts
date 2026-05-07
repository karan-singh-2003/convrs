/**
 * app/api/workspaces/[slug]/billing/trial/route.ts
 *
 * Grants a 14-day local trial on the Starter plan.
 *
 * Field names kept consistent with current Prisma schema
 * (stripeSubscriptionId). If you rename the schema field to
 * dodoSubscriptionId, update the guard check and the Prisma
 * update below in one go.
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
    // Uses dodoSubscriptionId — consistent with the Prisma schema field name.
    if (
      workspace.dodoSubscriptionId ||
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
        freeTrialEndDate: trialEnd,
        currentPeriodEnd: trialEnd,

        // No payment provider objects during a local trial.
        // Field name matches the Prisma schema (dodoSubscriptionId /
        // dodoCustomerId). Rename both here and in the schema together.
        dodoCustomerId: null,
        dodoSubscriptionId: null,

        // Lock trial to Starter plan, monthly billing, 10k events.
        plan: "free",
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
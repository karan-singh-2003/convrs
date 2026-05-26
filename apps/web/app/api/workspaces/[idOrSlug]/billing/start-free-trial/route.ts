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
import { Prisma } from "@prisma/client";

export const POST = withWorkspace(
  async ({ workspace, session }) => {
    const now = new Date();

    // Already in a valid trial.
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

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const user = await tx.user.findUnique({
            where: {
              id: session.user.id,
            },
            select: {
              id: true,
              freeTrialUsedAt: true,
            },
          });

          if (!user) {
            throw new Error("UNAUTHORIZED");
          }

          if (user.freeTrialUsedAt) {
            throw new Error("TRIAL_ALREADY_USED");
          }

          if (workspace.freeTrialEndDate) {
            throw new Error("WORKSPACE_TRIAL_ALREADY_USED");
          }

          const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

          await tx.user.update({
            where: {
              id: user.id,
            },
            data: {
              freeTrialUsedAt: now,
            },
          });

          const updatedWorkspace = await tx.workspace.update({
            where: {
              id: workspace.id,
            },
            data: {
              subscriptionStatus: "trialing",
              freeTrialEndDate: trialEnd,
              currentPeriodStart: now,
              currentPeriodEnd: trialEnd,
              dodoCustomerId: null,
              dodoSubscriptionId: null,
              plan: "free",
              billingInterval: "month",
              tierEvents: Starter_Plan.limits.events,
              usageLimit: Starter_Plan.limits.events,
            },
          });

          return {
            workspace: updatedWorkspace,
            trialEnd,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );

      return NextResponse.json({
        success: true,
        trialEndsAt: result.trialEnd.toISOString(),
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "UNAUTHORIZED") {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (error.message === "TRIAL_ALREADY_USED") {
          return NextResponse.json(
            {
              error:
                "You have already used your free trial. Please choose a plan to activate this workspace.",
            },
            { status: 403 }
          );
        }

        if (error.message === "WORKSPACE_TRIAL_ALREADY_USED") {
          return NextResponse.json(
            { error: "Free trial already used for this workspace." },
            { status: 400 }
          );
        }
      }

      console.error("[billing/start-trial]", error);

      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  },
  { requiredPermission: "billing:write" }
);

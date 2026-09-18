/**
 * app/api/workspaces/[idOrSlug]/billing/start-free-trial/route.ts
 *
 * Grants the user's one lifetime 14-day cardless trial (D7 / I-14) by creating
 * a trialing Subscription and attaching this workspace to it. No Dodo call.
 * Conversion to paid happens later via POST /api/subscriptions (reuses this
 * Subscription row).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { Prisma } from "@prisma/client";
import { resolvePlanBySpec, FAMILY_MAX_WORKSPACES } from "@/lib/billing/plan-resolver";
import { fanOutSubscription } from "@/lib/billing/fan-out";
import { familySchema, tierSchema } from "@/lib/zod/schemas/subscriptions";

const TRIAL_MS = 14 * 24 * 60 * 60 * 1000;

const bodySchema = z
  .object({
    family: familySchema.optional(),
    tier: tierSchema.optional(),
  })
  .optional();

export const POST = withWorkspace(
  async ({ req, workspace, session }) => {
    const now = new Date();

    if (
      workspace.subscriptionId &&
      workspace.subscriptionStatus === "trialing" &&
      workspace.freeTrialEndDate &&
      workspace.freeTrialEndDate > now
    ) {
      return NextResponse.json({ success: true, trialEndsAt: workspace.freeTrialEndDate.toISOString() });
    }

    if (workspace.subscriptionId) {
      return NextResponse.json(
        { error: "This website is already covered by a subscription." },
        { status: 400 },
      );
    }

    const parsed = bodySchema.parse(await req.json().catch(() => ({})));
    const family = parsed?.family ?? "standard";
    const tier = parsed?.tier ?? "t10k";
    const plan = resolvePlanBySpec({ family, tier, interval: "monthly" });
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, freeTrialUsedAt: true },
          });
          if (!user) throw new Error("UNAUTHORIZED");
          if (user.freeTrialUsedAt) throw new Error("TRIAL_ALREADY_USED");

          const trialEnd = new Date(now.getTime() + TRIAL_MS);

          await tx.user.update({ where: { id: user.id }, data: { freeTrialUsedAt: now } });

          const sub = await tx.subscription.create({
            data: {
              ownerUserId: user.id,
              planFamily: family,
              planTier: tier,
              tierEvents: plan.tierEvents,
              billingInterval: "month",
              currency: "USD",
              status: "trialing",
              maxWorkspaces: FAMILY_MAX_WORKSPACES[family],
              workspaceCount: 1,
              currentPeriodStart: now,
              currentPeriodEnd: trialEnd,
              trialEndsAt: trialEnd,
              dodoProductId: plan.productId,
            },
          });

          await tx.workspace.update({ where: { id: workspace.id }, data: { subscriptionId: sub.id } });
          await fanOutSubscription(sub.id, tx);

          return { trialEnd };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return NextResponse.json({ success: true, trialEndsAt: result.trialEnd.toISOString() });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (error.message === "TRIAL_ALREADY_USED") {
          return NextResponse.json(
            { error: "You have already used your free trial. Please choose a plan to activate this website." },
            { status: 403 },
          );
        }
      }
      console.error("[billing/start-free-trial]", error);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
  },
  { requiredPermission: "billing:write", skipEntitlementCheck: true },
);

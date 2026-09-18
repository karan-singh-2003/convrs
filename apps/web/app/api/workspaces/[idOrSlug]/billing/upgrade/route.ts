/**
 * app/api/workspaces/[idOrSlug]/billing/upgrade/route.ts
 *
 * DEPRECATED SHIM (Deploy 2). The pre-Deploy-3 billing UI still POSTs here with
 * { plan, family, period }. This translates the old tier NAME to the new
 * `planTier` key and forwards to the new subscription-service. Deleted in
 * Deploy 7 once the UI (Deploy 3) calls /api/subscriptions directly.
 */

import { NextResponse } from "next/server";
import * as z from "zod/v4";
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import {
  createSubscriptionCheckout,
  changePlan,
  BillingError,
} from "@/lib/billing/subscription-service";
import { mapDodoError } from "@/lib/billing/dodo-checkout";
import type { TierKey } from "@/lib/billing/plan-resolver";

// Map whatever the pre-Deploy-3b UI sends for `plan` -> a new planTier key.
// Accepts: raw tier keys, new event-size labels ("100k"), and the old
// WorkspacePlan marketing names ("starter"…"ultimate").
const PLAN_TO_KEY: Record<string, TierKey> = {
  // raw keys / new labels
  t10k: "t10k", "10k": "t10k",
  t100k: "t100k", "100k": "t100k",
  t200k: "t200k", "200k": "t200k",
  t500k: "t500k", "500k": "t500k",
  t1m: "t1m", "1m": "t1m",
  t2m: "t2m", "2m": "t2m",
  t5m: "t5m", "5m": "t5m",
  t10m: "t10m", "10m": "t10m",
  t10m_plus: "t10m_plus", "10m+": "t10m_plus",
  // legacy marketing names
  starter: "t10k",
  basic: "t100k",
  pro: "t200k",
  growth: "t500k",
  business: "t1m",
  scale: "t2m",
  "pro plus": "t5m",
  pro_plus: "t5m",
  enterprise: "t10m",
  ultimate: "t10m_plus",
};

const schema = z.object({
  plan: z.string(),
  family: z.enum(["standard", "growth"]).default("standard"),
  period: z.enum(["monthly", "yearly"]),
  baseUrl: z.string().optional(),
  onboarding: z.union([z.string(), z.boolean()]).nullish(),
});

export const POST = withWorkspace(
  async ({ req, workspace, session }) => {
    const body = schema.parse(await req.json());
    const tier = PLAN_TO_KEY[body.plan.toLowerCase()] ?? "t10k";
    const onboarding = body.onboarding === true || body.onboarding === "true";

    try {
      if (
        workspace.subscriptionId &&
        ["active", "trialing", "past_due"].includes(workspace.subscriptionStatus ?? "")
      ) {
        const result = await changePlan({
          actorUserId: session.user.id,
          subscriptionId: workspace.subscriptionId,
          targetFamily: body.family,
          targetTier: tier,
          targetInterval: body.period,
        });
        return NextResponse.json({ success: true, ...result });
      }

      const { checkoutUrl } = await createSubscriptionCheckout({
        actorUserId: session.user.id,
        intent: body.family,
        tier,
        interval: body.period,
        targetWorkspaceId: workspace.id,
        onboarding,
      });
      return NextResponse.json({ url: checkoutUrl });
    } catch (err) {
      if (err instanceof BillingError) {
        return NextResponse.json({ error: err.message, code: err.code, ...err.extra }, { status: err.httpStatus });
      }
      const mapped = mapDodoError(err);
      console.error("[billing/upgrade shim]", err);
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
  },
  { requiredPermission: "billing:write", skipEntitlementCheck: true },
);

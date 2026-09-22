/**
 * lib/billing/subscription-service.ts
 *
 * All Subscription lifecycle operations for Convrs's own billing.
 * See docs/billing-implementation-plan.md §5 and docs/billing-invariants.md.
 *
 * Authorisation: every mutating function takes `actorUserId` and requires
 * `actorUserId === Subscription.ownerUserId` (I-9 / D9). The workspace
 * `billing` role does NOT grant cross-workspace billing control.
 */

import { prisma } from "@repo/db";
import { Prisma } from "@repo/db/client";
import { dodo } from "@/lib/dodo";
import { getRemainingTrialDays } from "@/lib/billing/trial-utils";
import {
  createCheckoutSession,
  appUrl,
} from "@/lib/billing/dodo-checkout";
import {
  productIdFor,
  resolvePlanBySpec,
  FAMILY_MAX_WORKSPACES,
  type PlanFamily,
  type TierKey,
  type BillingInterval,
} from "@/lib/billing/plan-resolver";
import {
  fanOutSubscription,
  recomputeWorkspaceCount,
  INACTIVE_BASELINE,
} from "@/lib/billing/fan-out";
import type { PendingPlanChange } from "@/lib/dodo/types";
import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";

const TRIAL_DAYS = 14;
const NON_TERMINAL = ["inactive", "trialing", "active", "past_due", "canceling"] as const;
const ACTIVE_OR_TRIALING = ["active", "trialing"] as const;

export class BillingError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * What createSubscriptionCheckout() is allowed to write to a REUSED
 * cardless-trial Subscription row before Dodo Checkout has even opened, let
 * alone been completed. Never the target plan's identity (planFamily,
 * planTier, tierEvents, billingInterval, dodoProductId, maxWorkspaces) —
 * only a pending-consolidation marker, if this checkout intends to merge
 * other Standard subscriptions into this one once it activates.
 *
 * This is what makes an abandoned/closed checkout a no-op: the workspace's
 * real entitlement is never touched here, so with no patch to apply there's
 * nothing to undo. The plan itself is committed later, only by
 * webhook-processor.ts's existing `subscription.active`/`updated`/
 * `plan_changed` handling, which resolves the plan from the webhook
 * payload's own (Dodo-confirmed) `product_id` — never from what this
 * function returns. Pure — unit-tested.
 */
export function reuseTrialPreCheckoutPatch(
  pendingPlanChange: PendingPlanChange | undefined,
): { pendingPlanChange: PendingPlanChange } | null {
  return pendingPlanChange ? { pendingPlanChange } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.1  createSubscriptionCheckout
// ─────────────────────────────────────────────────────────────────────────────

export async function createSubscriptionCheckout(args: {
  actorUserId: string;
  intent: PlanFamily;
  tier: TierKey;
  interval: BillingInterval;
  targetWorkspaceId?: string;
  consolidateStandardSubIds?: string[];
  onboarding?: boolean;
}): Promise<{ checkoutUrl: string; internalSubscriptionId: string }> {
  const { actorUserId, intent, tier, interval } = args;

  // Callers (the billing UI's checkout(), the deprecated /billing/upgrade
  // shim) may pass either the raw Workspace.id or its display-prefixed
  // "ws_..." form (useWorkspace()'s `id` is always prefixed — see
  // lib/api/workspaces/workspace-id.ts). Normalize once, up front, so the
  // lookup below and the metadata embedded in the Dodo checkout session
  // (read back by the webhook processor's own findUnique) agree on the same
  // unprefixed id every caller's DB row actually uses.
  const targetWorkspaceId = args.targetWorkspaceId
    ? normalizeWorkspaceId(args.targetWorkspaceId)
    : undefined;

  const plan = resolvePlanBySpec({ family: intent, tier, interval });
  if (!plan) throw new BillingError("invalid_plan", "That plan is not available.", 400);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actorUserId },
    select: { id: true, email: true, name: true, dodoCustomerId: true, freeTrialUsedAt: true },
  });

  // I-12: one non-terminal Growth subscription per user.
  if (intent === "growth") {
    const existingGrowth = await prisma.subscription.findFirst({
      where: {
        ownerUserId: actorUserId,
        planFamily: "growth",
        status: { notIn: ["canceled", "expired"] },
      },
      select: { id: true },
    });
    if (existingGrowth) {
      throw new BillingError(
        "growth_subscription_exists",
        "You already have a Growth plan. Change its tier instead of buying another.",
        409,
      );
    }
  }

  // If converting an existing cardless trial, reuse its row.
  let reuseTrialSub: { id: string; trialEndsAt: Date | null } | null = null;
  if (targetWorkspaceId) {
    const ws = await prisma.workspace.findUnique({
      where: { id: targetWorkspaceId },
      select: { id: true, subscriptionId: true, subscription: { select: { id: true, status: true, ownerUserId: true, trialEndsAt: true, dodoSubscriptionId: true } } },
    });
    if (!ws) throw new BillingError("workspace_not_found", "Workspace not found.", 404);
    if (
      ws.subscription &&
      ws.subscription.ownerUserId === actorUserId &&
      ws.subscription.status === "trialing" &&
      !ws.subscription.dodoSubscriptionId
    ) {
      reuseTrialSub = { id: ws.subscription.id, trialEndsAt: ws.subscription.trialEndsAt };
    } else if (ws.subscriptionId) {
      throw new BillingError("workspace_covered", "That website is already covered by a subscription.", 409);
    }
  }

  // Trial: cardless trial conversion -> remaining days; first-ever paid -> 14; else none.
  let trialPeriodDays: number | null = null;
  if (reuseTrialSub) {
    trialPeriodDays = getRemainingTrialDays(reuseTrialSub.trialEndsAt);
  } else if (!user.freeTrialUsedAt) {
    trialPeriodDays = TRIAL_DAYS;
  }

  const pendingPlanChange: PendingPlanChange | undefined = args.consolidateStandardSubIds?.length
    ? {
        kind: "consolidate",
        effectiveAt: new Date().toISOString(),
        targetFamily: "growth",
        targetTier: tier,
        targetInterval: interval,
        consolidateStandardSubIds: args.consolidateStandardSubIds,
      }
    : undefined;

  // CRITICAL: when reusing an existing cardless trial, do NOT write the
  // target plan's identity (planFamily/planTier/tierEvents/billingInterval/
  // maxWorkspaces/dodoProductId) onto the row here. This row is the
  // workspace's real, already-attached entitlement — writing the target plan
  // now would silently commit it (e.g. Standard -> Growth) before the user
  // has done anything more than click a button, so an abandoned/closed Dodo
  // Checkout would leave the workspace looking like a real Growth customer
  // with no Dodo subscription behind it.
  //
  // The actual Dodo Checkout Session is still created below with the
  // correct target `plan.productId` (Dodo shows/charges the right plan
  // regardless of what our own row says), and `internalSubscriptionId` in
  // its metadata still points at this same row. The commit itself is left
  // to the existing, already-authoritative webhook-processor.ts: on
  // `subscription.active` (fired only once Dodo actually creates a real
  // subscription — i.e. checkout was completed, not merely opened) it
  // resolves the plan from the webhook payload's own `product_id` and
  // patches planFamily/planTier/tierEvents/billingInterval/dodoProductId/
  // maxWorkspaces from that authoritative source. An abandoned checkout
  // never fires that webhook, so the row simply stays untouched.
  const preCheckoutPatch = reuseTrialPreCheckoutPatch(pendingPlanChange);
  let sub: { id: string };
  if (reuseTrialSub != null) {
    sub = preCheckoutPatch
      ? await prisma.subscription.update({
          where: { id: reuseTrialSub.id },
          data: { pendingPlanChange: preCheckoutPatch.pendingPlanChange as unknown as Prisma.InputJsonValue },
          select: { id: true },
        })
      : { id: reuseTrialSub.id };
  } else {
    sub = await prisma.subscription.create({
      data: {
        ownerUserId: actorUserId,
        planFamily: intent,
        planTier: tier,
        tierEvents: plan.tierEvents,
        billingInterval: plan.billingInterval,
        currency: "USD",
        status: "inactive",
        maxWorkspaces: FAMILY_MAX_WORKSPACES[intent],
        workspaceCount: 0,
        dodoProductId: plan.productId,
        ...(trialPeriodDays ? { trialEndsAt: new Date(Date.now() + trialPeriodDays * 86_400_000) } : {}),
        ...(pendingPlanChange ? { pendingPlanChange: pendingPlanChange as unknown as Prisma.InputJsonValue } : {}),
      },
      select: { id: true },
    });
  }

  // Reserve the lifetime trial now (prevents a double-trial race).
  if (trialPeriodDays && !user.freeTrialUsedAt) {
    await prisma.user.update({ where: { id: actorUserId }, data: { freeTrialUsedAt: new Date() } });
  }

  const returnUrl = args.onboarding
    ? appUrl(`/onboarding/success?subscription=${sub.id}`)
    : appUrl(targetWorkspaceId ? `/?upgraded=true` : `/account/subscriptions?upgraded=true`);

  const { url } = await createCheckoutSession({
    productId: plan.productId,
    customer: user.dodoCustomerId
      ? { customerId: user.dodoCustomerId }
      : { email: user.email, name: user.name },
    metadata: {
      internalSubscriptionId: sub.id,
      ownerUserId: actorUserId,
      targetWorkspaceId: targetWorkspaceId ?? "",
      intent,
    },
    trialPeriodDays,
    returnUrl,
  });

  return { checkoutUrl: url, internalSubscriptionId: sub.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.2  changePlan
// ─────────────────────────────────────────────────────────────────────────────

const TIER_ORDER: TierKey[] = [
  "t10k", "t100k", "t200k", "t500k", "t1m", "t2m", "t5m", "t10m", "t10m_plus",
];

/**
 * Which workspace to keep when scheduling a Growth -> Standard downgrade.
 * With >1 workspace, the caller must have already validated `requested`
 * against the actual set (see the `keep_workspace_required` check above) —
 * this just passes it through. With 0 or 1 workspaces there's nothing to
 * choose, but the result must never be `undefined` when there IS a workspace:
 * webhook-processor.ts's detach step treats an unset `keepWorkspaceId` as
 * "detach everyone" (Prisma drops an `undefined` filter value rather than
 * matching nothing), so the sole workspace must be kept explicitly. Pure —
 * unit-tested.
 */
export function resolveKeepWorkspaceId(
  workspaceIds: string[],
  requested: string | undefined,
): string | undefined {
  if (workspaceIds.length > 1) return requested;
  return requested ?? workspaceIds[0];
}

export function isDowngradeTransition(
  cur: { family: PlanFamily; tier: TierKey },
  next: { family: PlanFamily; tier: TierKey },
): boolean {
  if (cur.family === "growth" && next.family === "standard") return true;
  if (cur.family === "standard" && next.family === "growth") return false;
  return TIER_ORDER.indexOf(next.tier) < TIER_ORDER.indexOf(cur.tier);
}

export async function changePlan(args: {
  actorUserId: string;
  subscriptionId: string;
  targetFamily: PlanFamily;
  targetTier: TierKey;
  targetInterval: BillingInterval;
  keepWorkspaceId?: string;
  acknowledgeDetachWorkspaceIds?: string[];
}): Promise<{ scheduled: boolean; effectiveAt?: string }> {
  const sub = await loadOwnedSubscription(args.subscriptionId, args.actorUserId);
  if (!sub.dodoSubscriptionId) {
    throw new BillingError("no_dodo_subscription", "This subscription is not active yet.", 409);
  }
  if (!["active", "trialing", "past_due"].includes(sub.status)) {
    throw new BillingError("bad_status", `Cannot change plan while the subscription is ${sub.status}.`, 409);
  }

  const targetPlan = resolvePlanBySpec({
    family: args.targetFamily,
    tier: args.targetTier,
    interval: args.targetInterval,
  });
  if (!targetPlan) throw new BillingError("invalid_plan", "That plan is not available.", 400);

  const sameInterval =
    (args.targetInterval === "monthly" && sub.billingInterval === "month") ||
    (args.targetInterval === "yearly" && sub.billingInterval === "year");
  if (
    sub.planFamily === args.targetFamily &&
    sub.planTier === args.targetTier &&
    sameInterval
  ) {
    throw new BillingError("no_op", "You're already on this plan.", 400);
  }

  // Growth -> Standard with >1 workspace: gated + scheduled.
  if (sub.planFamily === "growth" && args.targetFamily === "standard") {
    const workspaces = await prisma.workspace.findMany({
      where: { subscriptionId: sub.id },
      select: { id: true, slug: true },
    });
    if (workspaces.length > 1) {
      if (!args.keepWorkspaceId || !workspaces.some((w) => w.id === args.keepWorkspaceId)) {
        throw new BillingError(
          "keep_workspace_required",
          "Standard covers one website. Choose which website to keep.",
          422,
          { workspaces },
        );
      }
      const expectedDetach = new Set(workspaces.filter((w) => w.id !== args.keepWorkspaceId).map((w) => w.id));
      const ack = new Set(args.acknowledgeDetachWorkspaceIds ?? []);
      if (ack.size !== expectedDetach.size || [...expectedDetach].some((id) => !ack.has(id))) {
        throw new BillingError(
          "acknowledgement_required",
          "You must acknowledge the websites that will be paused.",
          422,
          { detachWorkspaceIds: [...expectedDetach] },
        );
      }
    }
    const keepWorkspaceId = resolveKeepWorkspaceId(workspaces.map((w) => w.id), args.keepWorkspaceId);
    return scheduleChange(sub, targetPlan.productId, {
      kind: "downgrade_to_standard",
      effectiveAt: sub.currentPeriodEnd?.toISOString() ?? new Date().toISOString(),
      targetFamily: "standard",
      targetTier: args.targetTier,
      targetInterval: args.targetInterval,
      keepWorkspaceId,
    });
  }

  const downgrade = isDowngradeTransition(
    { family: sub.planFamily as PlanFamily, tier: sub.planTier as TierKey },
    { family: args.targetFamily, tier: args.targetTier },
  );

  // Same-price change (only Growth-yearly t100k<->t200k) or any tier-down -> scheduled.
  if (downgrade) {
    return scheduleChange(sub, targetPlan.productId, {
      kind: "tier_down",
      effectiveAt: sub.currentPeriodEnd?.toISOString() ?? new Date().toISOString(),
      targetFamily: args.targetFamily,
      targetTier: args.targetTier,
      targetInterval: args.targetInterval,
    });
  }

  // Immediate upgrade (incl. standard -> growth).
  await dodo.subscriptions.changePlan(sub.dodoSubscriptionId, {
    product_id: targetPlan.productId,
    quantity: 1,
    proration_billing_mode: "prorated_immediately",
    effective_at: "immediately",
    on_payment_failure: "prevent_change",
  });

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: sub.id },
      data: {
        planFamily: args.targetFamily,
        planTier: args.targetTier,
        tierEvents: targetPlan.tierEvents,
        billingInterval: targetPlan.billingInterval,
        dodoProductId: targetPlan.productId,
        maxWorkspaces: FAMILY_MAX_WORKSPACES[args.targetFamily],
      },
    });
    await fanOutSubscription(sub.id, tx);
  });

  return { scheduled: false };
}

async function scheduleChange(
  sub: OwnedSubscription,
  productId: string,
  pending: PendingPlanChange,
): Promise<{ scheduled: true; effectiveAt: string }> {
  await dodo.subscriptions.changePlan(sub.dodoSubscriptionId!, {
    product_id: productId,
    quantity: 1,
    proration_billing_mode: "do_not_bill",
    on_payment_failure: "prevent_change",
  });
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { pendingPlanChange: pending as unknown as Prisma.InputJsonValue },
  });
  return { scheduled: true, effectiveAt: pending.effectiveAt };
}

/** Cancel a scheduled (pending) plan change before it takes effect. */
export async function cancelScheduledChange(subscriptionId: string, actorUserId: string): Promise<void> {
  const sub = await loadOwnedSubscription(subscriptionId, actorUserId);
  if (sub.dodoSubscriptionId) {
    await dodo.subscriptions.cancelChangePlan(sub.dodoSubscriptionId).catch(() => {});
  }
  await prisma.subscription.update({ where: { id: sub.id }, data: { pendingPlanChange: Prisma.DbNull } });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.3  cancel / resume
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelSubscription(args: {
  actorUserId: string;
  subscriptionId: string;
  mode: "at_period_end" | "immediately";
  acknowledgeWorkspaceIds?: string[];
}): Promise<{ status: string }> {
  const sub = await loadOwnedSubscription(args.subscriptionId, args.actorUserId);
  if (!sub.dodoSubscriptionId) {
    // cardless trial -> just deactivate locally
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({ where: { id: sub.id }, data: { status: "canceled", workspaceCount: 0 } });
      await tx.workspace.updateMany({ where: { subscriptionId: sub.id }, data: INACTIVE_BASELINE });
    });
    return { status: "canceled" };
  }

  const workspaces = await prisma.workspace.findMany({
    where: { subscriptionId: sub.id },
    select: { id: true },
  });
  if (sub.planFamily === "growth" && workspaces.length > 1) {
    const ack = new Set(args.acknowledgeWorkspaceIds ?? []);
    if (ack.size !== workspaces.length || workspaces.some((w) => !ack.has(w.id))) {
      throw new BillingError(
        "acknowledgement_required",
        `This cancels all ${workspaces.length} websites on your Growth plan.`,
        422,
        { workspaceIds: workspaces.map((w) => w.id) },
      );
    }
  }

  if (args.mode === "at_period_end") {
    await dodo.subscriptions.update(sub.dodoSubscriptionId, {
      cancel_at_next_billing_date: true,
      cancel_reason: "cancelled_by_customer",
    });
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({ where: { id: sub.id }, data: { status: "canceling", cancelAtPeriodEnd: true } });
      await fanOutSubscription(sub.id, tx);
    });
    return { status: "canceling" };
  }

  // immediate — webhook subscription.cancelled/expired will finalise; act locally too.
  await dodo.subscriptions.update(sub.dodoSubscriptionId, {
    status: "cancelled",
    cancel_reason: "cancelled_by_customer",
  });
  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: sub.id },
      data: { status: "canceled", cancelAtPeriodEnd: true, workspaceCount: 0 },
    });
    await tx.workspace.updateMany({ where: { subscriptionId: sub.id }, data: INACTIVE_BASELINE });
  });
  return { status: "canceled" };
}

export async function resumeSubscription(subscriptionId: string, actorUserId: string): Promise<void> {
  const sub = await loadOwnedSubscription(subscriptionId, actorUserId);
  if (sub.dodoSubscriptionId) {
    await dodo.subscriptions.update(sub.dodoSubscriptionId, { cancel_at_next_billing_date: false });
  }
  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: sub.id },
      data: { status: "active", cancelAtPeriodEnd: false },
    });
    await fanOutSubscription(sub.id, tx);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.4  attachWorkspace   (Scenario 5 — no Dodo call, no payment)
// ─────────────────────────────────────────────────────────────────────────────

export async function attachWorkspace(args: {
  actorUserId: string;
  workspaceId: string;
  subscriptionId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // guarded seat claim — raw SQL because Prisma can't compare two columns
    const claimed = await tx.$executeRaw`
      UPDATE "Subscription"
      SET "workspaceCount" = "workspaceCount" + 1, "updatedAt" = now()
      WHERE "id" = ${args.subscriptionId}
        AND "ownerUserId" = ${args.actorUserId}
        AND "status" IN ('active', 'trialing')
        AND "workspaceCount" < "maxWorkspaces"`;
    if (claimed === 0) {
      throw new BillingError(
        "seat_limit_or_inactive",
        "This plan can't cover another website (it's full or not active).",
        409,
      );
    }

    const linked = await tx.workspace.updateMany({
      where: { id: args.workspaceId, subscriptionId: null },
      data: { subscriptionId: args.subscriptionId },
    });
    if (linked.count === 0) {
      // workspace already covered / not found -> undo the claim
      throw new BillingError("workspace_covered", "That website is already covered.", 409);
    }

    await fanOutSubscription(args.subscriptionId, tx);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.5  detachWorkspace
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Only the SUBSCRIPTION owner (the billing payer, D9) may detach a website
 * from it — being the *workspace's* own `owner`-role member is not enough. A
 * workspace can be owned by someone other than the person paying for the
 * Growth/Standard subscription it's attached to (e.g. an invited team member
 * with `owner` role on that one workspace); letting them detach would let
 * them unilaterally mutate someone else's subscription (seat count,
 * auto-cancel-when-empty) without the billing owner's consent. Pure/exported
 * so this authorization rule is unit-testable without mocking Prisma.
 */
export function canDetachWorkspace(args: {
  subscriptionOwnerId: string;
  actorUserId: string;
}): boolean {
  return args.subscriptionOwnerId === args.actorUserId;
}

export async function detachWorkspace(args: {
  actorUserId: string;
  workspaceId: string;
}): Promise<{ scheduledCancelSubscriptionId?: string }> {
  const ws = await prisma.workspace.findUnique({
    where: { id: args.workspaceId },
    select: {
      id: true,
      subscriptionId: true,
      subscription: { select: { id: true, ownerUserId: true, planFamily: true, dodoSubscriptionId: true } },
    },
  });
  if (!ws || !ws.subscriptionId || !ws.subscription) {
    throw new BillingError("not_covered", "That website isn't covered by a subscription.", 409);
  }
  if (!canDetachWorkspace({ subscriptionOwnerId: ws.subscription.ownerUserId, actorUserId: args.actorUserId })) {
    throw new BillingError("forbidden", "You can't change this website's subscription.", 403);
  }

  const subId = ws.subscription.id;
  let scheduledCancel: string | undefined;

  await prisma.$transaction(async (tx) => {
    await tx.workspace.update({ where: { id: args.workspaceId }, data: INACTIVE_BASELINE });
    await recomputeWorkspaceCount(subId, tx);
  });

  // D5: a Standard subscription with no workspaces auto-schedules cancellation.
  const after = await prisma.subscription.findUnique({
    where: { id: subId },
    select: { planFamily: true, workspaceCount: true, dodoSubscriptionId: true, status: true, ownerUserId: true },
  });
  if (
    after &&
    after.planFamily === "standard" &&
    after.workspaceCount === 0 &&
    after.dodoSubscriptionId &&
    !["canceling", "canceled", "expired"].includes(after.status)
  ) {
    await dodo.subscriptions
      .update(after.dodoSubscriptionId, {
        cancel_at_next_billing_date: true,
        cancel_reason: "cancelled_by_merchant",
      })
      .then(() => prisma.subscription.update({ where: { id: subId }, data: { status: "canceling", cancelAtPeriodEnd: true } }))
      .catch((e) => console.error("[detachWorkspace] auto-cancel failed", subId, e));
    scheduledCancel = subId;
  }

  return { scheduledCancelSubscriptionId: scheduledCancel };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.6  consolidateStandardSubs   (Scenario 4)
// ─────────────────────────────────────────────────────────────────────────────

export async function consolidateStandardSubs(args: {
  growthSubscriptionId: string;
  standardSubIds: string[];
}): Promise<void> {
  const growth = await prisma.subscription.findUniqueOrThrow({
    where: { id: args.growthSubscriptionId },
    select: { id: true, ownerUserId: true, maxWorkspaces: true },
  });

  const standardSubs = await prisma.subscription.findMany({
    where: { id: { in: args.standardSubIds }, ownerUserId: growth.ownerUserId },
    select: { id: true, dodoSubscriptionId: true },
  });

  const workspaces = await prisma.workspace.findMany({
    where: { subscriptionId: { in: [growth.id, ...standardSubs.map((s) => s.id)] } },
    select: { id: true },
  });
  if (workspaces.length > growth.maxWorkspaces) {
    console.error("[consolidateStandardSubs] would exceed maxWorkspaces", growth.id, workspaces.length);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspace.updateMany({
      where: { subscriptionId: { in: standardSubs.map((s) => s.id) } },
      data: { subscriptionId: growth.id },
    });
    await recomputeWorkspaceCount(growth.id, tx);
    for (const s of standardSubs) {
      await tx.subscription.update({
        where: { id: s.id },
        data: { status: "canceling", cancelAtPeriodEnd: true, workspaceCount: 0 },
      });
    }
    await fanOutSubscription(growth.id, tx);
  });

  // After the tx: cancel the redundant Dodo subscriptions (safe direction — workspaces already moved).
  for (const s of standardSubs) {
    if (!s.dodoSubscriptionId) continue;
    await dodo.subscriptions
      .update(s.dodoSubscriptionId, {
        cancel_at_next_billing_date: true,
        cancel_reason: "cancelled_by_merchant",
      })
      .catch((e) => console.error("[consolidateStandardSubs] cancel failed", s.id, e));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads for the API
// ─────────────────────────────────────────────────────────────────────────────

export interface SubscriptionSummary {
  id: string;
  planFamily: PlanFamily;
  planTier: string;
  interval: "monthly" | "yearly" | null;
  status: string;
  workspaceCount: number;
  maxWorkspaces: number;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  pendingPlanChange: PendingPlanChange | null;
  workspaces: { id: string; slug: string; name: string }[];
}

export async function listUserSubscriptions(userId: string): Promise<SubscriptionSummary[]> {
  const subs = await prisma.subscription.findMany({
    where: { ownerUserId: userId },
    orderBy: { createdAt: "asc" },
    include: { workspaces: { select: { id: true, slug: true, name: true } } },
  });
  return subs.map((s) => ({
    id: s.id,
    planFamily: s.planFamily as PlanFamily,
    planTier: s.planTier,
    interval: s.billingInterval === "year" ? "yearly" : s.billingInterval === "month" ? "monthly" : null,
    status: s.status,
    workspaceCount: s.workspaceCount,
    maxWorkspaces: s.maxWorkspaces,
    currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    pendingPlanChange: (s.pendingPlanChange as PendingPlanChange | null) ?? null,
    workspaces: s.workspaces,
  }));
}

export async function getBillingContext(userId: string) {
  const [user, subs] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { dodoCustomerId: true, freeTrialUsedAt: true } }),
    listUserSubscriptions(userId),
  ]);

  const growthSub = subs.find(
    (s) => s.planFamily === "growth" && !["canceled", "expired"].includes(s.status),
  );

  return {
    dodoCustomerId: user.dodoCustomerId,
    trialAvailable: user.freeTrialUsedAt == null,
    subscriptions: subs.map((s) => ({
      id: s.id,
      planFamily: s.planFamily,
      planTier: s.planTier,
      interval: s.interval,
      status: s.status,
      workspaceCount: s.workspaceCount,
      maxWorkspaces: s.maxWorkspaces,
      currentPeriodEnd: s.currentPeriodEnd,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    })),
    growthSubWithFreeSeat:
      growthSub && growthSub.workspaceCount < growthSub.maxWorkspaces
        ? { id: growthSub.id, workspaceCount: growthSub.workspaceCount, maxWorkspaces: growthSub.maxWorkspaces }
        : null,
    standardSubs: subs
      .filter((s) => s.planFamily === "standard" && !["canceled", "expired"].includes(s.status))
      .map((s) => ({ id: s.id, planTier: s.planTier, workspaceId: s.workspaces[0]?.id ?? null })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

interface OwnedSubscription {
  id: string;
  ownerUserId: string;
  status: string;
  planFamily: string;
  planTier: string;
  billingInterval: string | null;
  dodoSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
}

async function loadOwnedSubscription(subscriptionId: string, actorUserId: string): Promise<OwnedSubscription> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      ownerUserId: true,
      status: true,
      planFamily: true,
      planTier: true,
      billingInterval: true,
      dodoSubscriptionId: true,
      currentPeriodEnd: true,
    },
  });
  if (!sub) throw new BillingError("subscription_not_found", "Subscription not found.", 404);
  if (sub.ownerUserId !== actorUserId) throw new BillingError("forbidden", "Not your subscription.", 403);
  return sub;
}

// ─────────────────────────────────────────────────────────────────────────────
// System-level seat release (workspace deletion — no actor auth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called from the workspace-deletion flow AFTER the workspace's subscriptionId
 * has been nulled. Recomputes the seat count and, for a now-empty Standard
 * subscription, schedules its Dodo cancellation (D5).
 */
export async function releaseSubscriptionSeat(subscriptionId: string): Promise<void> {
  await recomputeWorkspaceCount(subscriptionId, prisma);
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { planFamily: true, workspaceCount: true, dodoSubscriptionId: true, status: true },
  });
  if (
    sub &&
    sub.planFamily === "standard" &&
    sub.workspaceCount === 0 &&
    sub.dodoSubscriptionId &&
    !["canceling", "canceled", "expired"].includes(sub.status)
  ) {
    await dodo.subscriptions
      .update(sub.dodoSubscriptionId, {
        cancel_at_next_billing_date: true,
        cancel_reason: "cancelled_by_merchant",
      })
      .then(() =>
        prisma.subscription.update({
          where: { id: subscriptionId },
          data: { status: "canceling", cancelAtPeriodEnd: true },
        }),
      )
      .catch((e) => console.error("[releaseSubscriptionSeat] auto-cancel failed", subscriptionId, e));
  }
}

export { productIdFor, resolvePlanBySpec, NON_TERMINAL, ACTIVE_OR_TRIALING };

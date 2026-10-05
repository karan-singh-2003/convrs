/**
 * lib/billing/entitlement.ts
 *
 * Single source of truth for "does this workspace's plan unlock feature X" and
 * "does this workspace currently have access at all". Route handlers import
 * from here rather than re-deriving `planFamily === "growth"` / status checks
 * inline.
 *
 * Deploy 2: reads the denormalized cache on `Workspace` (`subscriptionStatus`,
 * `planFamily`, `planTier`, `freeTrialEndDate`, `paymentFailedAt`) — written
 * only by the webhook fan-out / attach / detach (I-8). Does NOT read the
 * retired `Workspace.plan` enum (Decision D3).
 *
 * `isEntitled` delegates to `@repo/analytics`'s `isWorkspaceEntitled` so the
 * `past_due` grace window (D6) is enforced by the exact same code here and in
 * `apps/ingestion/src/controllers/track.ts` — see that shared implementation
 * for the per-status policy (including the `canceling` → still-entitled and
 * `past_due` → 7-day-grace rules).
 */

import { isWorkspaceEntitled, type WorkspaceAccessState } from "@repo/analytics";

type EntitlementWorkspace = WorkspaceAccessState & {
  planFamily?: string | null;
  planTier?: string | null;
};

/** Does this workspace currently have paid/trial access? */
export function isEntitled(workspace: EntitlementWorkspace): boolean {
  return isWorkspaceEntitled(workspace);
}

export interface CurrentPlan {
  family: string;
  tier: string;
  billingInterval: string | null;
}

/**
 * Derived billing state for a workspace, all decided by `isEntitled`. A
 * Subscription row keeps its plan fields after a cardless trial lapses (for
 * history), so the stored plan alone never means the workspace has that plan.
 *
 *  - isTrialing:                entitled via an unexpired cardless trial
 *  - hasActivePaidSubscription: entitled via a real Dodo subscription
 *                               (includes `canceling` and `past_due` grace)
 *  - isTrialExpired:            a cardless trial that ended without converting
 *  - currentPlan:               the subscription's plan while entitled, else null
 */
export interface BillingState {
  isEntitled: boolean;
  isTrialing: boolean;
  isTrialExpired: boolean;
  hasActivePaidSubscription: boolean;
  currentPlan: CurrentPlan | null;
}

export function getBillingState(
  workspace: EntitlementWorkspace,
  subscription: {
    planFamily: string;
    planTier: string;
    billingInterval: string | null;
    trialEndsAt?: Date | string | null;
    dodoSubscriptionId?: string | null;
  } | null,
): BillingState {
  const entitled = isEntitled(workspace);
  const cardless = !subscription?.dodoSubscriptionId;
  const trialEnd = subscription?.trialEndsAt ?? workspace.freeTrialEndDate ?? null;
  const trialEnded = trialEnd != null && new Date(trialEnd).getTime() <= Date.now();

  return {
    isEntitled: entitled,
    isTrialing: entitled && cardless && workspace.subscriptionStatus === "trialing",
    isTrialExpired: !entitled && cardless && trialEnded,
    hasActivePaidSubscription: entitled && !cardless,
    currentPlan:
      entitled && subscription
        ? {
            family: subscription.planFamily,
            tier: subscription.planTier,
            billingInterval: subscription.billingInterval,
          }
        : null,
  };
}

/** Growth-only: X/Reddit link attribution & social mentions. */
export function workspaceHasSocialAttribution(workspace: EntitlementWorkspace): boolean {
  if (!isEntitled(workspace)) return false;
  return (workspace.planFamily ?? "standard") === "growth";
}

/** Standard shape for a 402 upgrade-required response body. */
export function upgradeRequiredResponse(message: string) {
  return new Response(
    JSON.stringify({ error: message, code: "upgrade_required" }),
    { status: 402, headers: { "Content-Type": "application/json" } },
  );
}

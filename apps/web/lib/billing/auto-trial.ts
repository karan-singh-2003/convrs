/**
 * lib/billing/auto-trial.ts
 *
 * Automatic 14-day cardless trial activation on workspace creation.
 *
 * Reuses the exact trial-granting shape of
 * `app/api/workspaces/[idOrSlug]/billing/start-free-trial/route.ts` (I-14 in
 * docs/billing-invariants.md): a `Serializable` transaction that creates a
 * `trialing` Subscription, sets `User.freeTrialUsedAt` in the same tx,
 * attaches the workspace, and fans out the denormalized cache. What's
 * different here is *when* it runs (automatically, from `POST
 * /api/workspaces`, immediately after the workspace row is created — no
 * user action, no billing-page visit) and *who* it's offered to: only a
 * user's first-ever *owned* workspace (being a member/invitee of someone
 * else's workspace does not count — see `isAutoTrialEligible`), and only
 * when they hold no `Subscription` row at all yet. That's stricter than the
 * manual start-free-trial route, which only guards on `freeTrialUsedAt` plus
 * the target workspace's own state.
 *
 * Best-effort by design: the caller (`POST /api/workspaces`) must only
 * invoke this *after* the workspace already exists, and must treat any
 * failure here (ineligibility, or a genuine Serializable conflict from a
 * concurrent request) as "no trial" — it must never fail workspace creation
 * or retry into a duplicate grant.
 */

import { Prisma } from "@repo/db/client";
import { prisma } from "@repo/db";
import { resolvePlanBySpec, FAMILY_MAX_WORKSPACES } from "./plan-resolver";
import { fanOutSubscription } from "./fan-out";

const TRIAL_MS = 14 * 24 * 60 * 60 * 1000;
const AUTO_TRIAL_FAMILY = "standard" as const;
const AUTO_TRIAL_TIER = "t10k" as const;

export interface AutoTrialEligibilityInput {
  /** `User.freeTrialUsedAt` — set once, for life, the moment any trial is granted (I-14). */
  freeTrialUsedAt: Date | null;
  /**
   * Count of `WorkspaceUsers` rows with `role: "owner"` for this user,
   * *excluding* the just-created workspace. Zero means the workspace just
   * created is the first one this user has ever created themselves. Being a
   * member/invitee (`role: "member" | "viewer" | "billing"`) of someone
   * else's workspace must NOT count here — only workspaces this user
   * created disqualify "first workspace".
   */
  priorOwnedWorkspaceCount: number;
  /** Any `Subscription` row at all owned by this user, any status. */
  hasExistingSubscription: boolean;
}

/**
 * Pure eligibility predicate — no I/O, trivially unit-testable. All three
 * conditions must hold for a brand-new workspace to auto-start a trial.
 */
export function isAutoTrialEligible({
  freeTrialUsedAt,
  priorOwnedWorkspaceCount,
  hasExistingSubscription,
}: AutoTrialEligibilityInput): boolean {
  return (
    freeTrialUsedAt == null &&
    priorOwnedWorkspaceCount === 0 &&
    !hasExistingSubscription
  );
}

export type AutoTrialResult =
  | { granted: true; trialEndsAt: Date }
  | {
      granted: false;
      reason: "trial-already-used" | "has-subscription" | "not-first-workspace";
    };

/**
 * Grants the automatic first-workspace trial if (and only if) the owning
 * user is eligible, in its own `Serializable` transaction. Call strictly
 * *after* `workspaceId` already exists in the database — never before.
 *
 * Idempotent / race-safe: every condition is re-checked inside the
 * `Serializable` transaction (not just by the caller beforehand), so two
 * concurrent requests for the same user can grant at most one trial — the
 * loser either observes `freeTrialUsedAt` already set, or the transaction
 * itself throws on a serialization conflict, which callers must treat as
 * "no trial" and swallow, never blindly retry.
 */
export async function grantAutoTrialForNewWorkspace({
  userId,
  workspaceId,
}: {
  userId: string;
  workspaceId: string;
}): Promise<AutoTrialResult> {
  return prisma.$transaction(
    async (tx) => {
      const [user, priorOwnedWorkspaceCount, existingSubscriptionCount] =
        await Promise.all([
          tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { freeTrialUsedAt: true },
          }),
          // Owner-created workspaces only (I-14 + this feature's "first
          // OWNED workspace" rule) — a role of member/viewer/billing on
          // someone else's workspace must never disqualify a user's own
          // first creation.
          tx.workspaceUsers.count({
            where: {
              userId,
              role: "owner",
              workspaceId: { not: workspaceId },
            },
          }),
          tx.subscription.count({ where: { ownerUserId: userId } }),
        ]);

      const hasExistingSubscription = existingSubscriptionCount > 0;

      if (
        !isAutoTrialEligible({
          freeTrialUsedAt: user.freeTrialUsedAt,
          priorOwnedWorkspaceCount,
          hasExistingSubscription,
        })
      ) {
        if (user.freeTrialUsedAt != null) {
          return { granted: false, reason: "trial-already-used" };
        }
        if (hasExistingSubscription) {
          return { granted: false, reason: "has-subscription" };
        }
        return { granted: false, reason: "not-first-workspace" };
      }

      const plan = resolvePlanBySpec({
        family: AUTO_TRIAL_FAMILY,
        tier: AUTO_TRIAL_TIER,
        interval: "monthly",
      });
      if (!plan) {
        // Catalog misconfiguration — surfaces as a thrown error the caller
        // logs and swallows; must never block workspace creation.
        throw new Error("AUTO_TRIAL_PLAN_UNRESOLVED");
      }

      const now = new Date();
      const trialEnd = new Date(now.getTime() + TRIAL_MS);

      await tx.user.update({
        where: { id: userId },
        data: { freeTrialUsedAt: now },
      });

      const sub = await tx.subscription.create({
        data: {
          ownerUserId: userId,
          planFamily: AUTO_TRIAL_FAMILY,
          planTier: AUTO_TRIAL_TIER,
          tierEvents: plan.tierEvents,
          billingInterval: "month",
          currency: "USD",
          status: "trialing",
          maxWorkspaces: FAMILY_MAX_WORKSPACES[AUTO_TRIAL_FAMILY],
          workspaceCount: 1,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
          trialEndsAt: trialEnd,
          dodoProductId: plan.productId,
        },
      });

      await tx.workspace.update({
        where: { id: workspaceId },
        data: { subscriptionId: sub.id },
      });
      await fanOutSubscription(sub.id, tx);

      return { granted: true, trialEndsAt: trialEnd };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

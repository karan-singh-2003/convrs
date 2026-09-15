/**
 * lib/billing/billing-identity.ts
 *
 * Resolves which Dodo customer a workspace's invoices/payment-methods/
 * customer-portal routes are allowed to read, per D9 (`Subscription.ownerUserId`
 * is authoritative for billing management).
 *
 * These Dodo endpoints are keyed on `User.dodoCustomerId`, which can span
 * every subscription that user owns — not just the one workspace being
 * viewed. Before this existed, the routes used the *viewing session user's
 * own* `dodoCustomerId` regardless of who actually owns the workspace's
 * subscription: the owner saw their own data correctly, but a workspace
 * member with `billing:read`/`billing:write` who is NOT the subscription
 * owner saw their own (usually empty/unrelated) Dodo data instead of the
 * workspace's real billing — silently wrong, not a crash.
 *
 * The fix is NOT to show that non-owner the owner's cross-subscription Dodo
 * history (that would be a real cross-customer exposure — the owner's data
 * spans workspaces this viewer may have no relationship to at all). Instead,
 * only the actual subscription owner may view or manage this data; anyone
 * else with workspace-level `billing:*` permission is refused with a clear
 * 403 rather than being shown incorrect or unrelated data.
 */

import { prisma } from "@repo/db";

export class BillingIdentityError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type BillingIdentityDecision = "no_subscription" | "authorized" | "forbidden";

/**
 * Pure authorization decision — no I/O. Pulled out of
 * `requireBillingOwnerDodoCustomerId` so the D9 rule ("only the subscription
 * owner may view/manage billing") is unit-testable without mocking Prisma:
 *  - no subscription on the workspace yet -> "no_subscription" (not an authz
 *    question; every route already handles this as a graceful empty/400)
 *  - caller IS the subscription's ownerUserId -> "authorized"
 *  - workspace has a subscription owned by someone else -> "forbidden"
 */
export function decideBillingIdentity(
  subscriptionOwnerUserId: string | null | undefined,
  actorUserId: string,
): BillingIdentityDecision {
  if (!subscriptionOwnerUserId) return "no_subscription";
  return subscriptionOwnerUserId === actorUserId ? "authorized" : "forbidden";
}

/**
 * Returns the Dodo customer id to use for this workspace's billing routes, or
 * `null` when the workspace has no subscription yet (not an authorization
 * question — every route already handles "no billing account yet" as a
 * graceful empty/400 response for any caller).
 *
 * Throws `BillingIdentityError` (403) when the workspace IS covered by a
 * subscription but the caller is not its owner.
 */
export async function requireBillingOwnerDodoCustomerId(
  workspaceId: string,
  actorUserId: string,
): Promise<string | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { subscription: { select: { ownerUserId: true } } },
  });

  const decision = decideBillingIdentity(workspace?.subscription?.ownerUserId, actorUserId);

  if (decision === "no_subscription") return null;
  if (decision === "forbidden") {
    throw new BillingIdentityError(
      403,
      "Only the subscription owner can view or manage billing for this website.",
    );
  }

  const owner = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { dodoCustomerId: true },
  });
  return owner?.dodoCustomerId ?? null;
}

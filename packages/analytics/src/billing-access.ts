/**
 * src/billing-access.ts
 *
 * Single source of truth for "does this workspace currently have paid/trial
 * access" — D6 (7-day `past_due` grace from `paymentFailedAt`) requires this
 * be enforced *identically* in apps/web (dashboard gating, `hasWorkspaceAccess`)
 * and apps/ingestion (`track.ts`). Both import this function rather than each
 * re-deriving the status policy, so the two can't drift out of sync.
 *
 * Reads only the denormalized billing cache fanned out onto `Workspace`
 * (`subscriptionStatus`, `freeTrialEndDate`, `paymentFailedAt`) — never the
 * retired `Workspace.plan` enum.
 */

/** D6: how long a `past_due` workspace keeps access after its first failed payment. */
export const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export interface WorkspaceAccessState {
  subscriptionStatus?: string | null;
  freeTrialEndDate?: Date | string | null;
  paymentFailedAt?: Date | string | null;
}

/**
 * Does this workspace currently have paid/trial access?
 *
 *  - `active`              → yes
 *  - `canceling`            → yes (cancellation is scheduled for period end;
 *                             access continues until the subscription actually
 *                             terminates — the webhook/reconcile cron flips
 *                             this to `canceled`/`expired` once the period ends)
 *  - `trialing`             → yes, while `freeTrialEndDate` is in the future
 *  - `past_due`             → yes, for `PAST_DUE_GRACE_MS` (7 days) from
 *                             `paymentFailedAt` (D6), then no
 *  - `inactive`/`canceled`/`expired` → no
 */
export function isWorkspaceEntitled(workspace: WorkspaceAccessState): boolean {
  const status = workspace.subscriptionStatus ?? "inactive";

  if (status === "active" || status === "canceling") return true;

  if (status === "trialing") {
    const end = workspace.freeTrialEndDate ? new Date(workspace.freeTrialEndDate) : null;
    return !!end && end.getTime() > Date.now();
  }

  if (status === "past_due") {
    const failedAt = workspace.paymentFailedAt ? new Date(workspace.paymentFailedAt) : null;
    return !!failedAt && Date.now() - failedAt.getTime() < PAST_DUE_GRACE_MS;
  }

  return false;
}

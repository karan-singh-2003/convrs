/**
 * lib/billing/entitlements.ts
 *
 * Single source of truth for "does this workspace's plan unlock feature X."
 * Route handlers should import from here rather than re-deriving
 * `planFamily === "growth"` checks inline in multiple places — if the
 * gating rule ever changes (e.g. only some Growth tiers unlock it), this
 * is the only file that needs to change.
 */

import { getPlanDetails, type PricingFamily } from "@repo/utils";

type EntitlementWorkspace = {
  plan: string | null;
  planFamily?: PricingFamily | null;
};

export function workspaceHasSocialAttribution(
  workspace: EntitlementWorkspace
): boolean {
  if (!workspace.plan) return false;

  const family = workspace.planFamily ?? "standard";
  if (family !== "growth") return false;

  const { plan } = getPlanDetails({ plan: workspace.plan, family });
  return plan?.unlocksSocialAttribution ?? false;
}

/** Standard shape for a 402 upgrade-required response body. */
export function upgradeRequiredResponse(message: string) {
  return new Response(
    JSON.stringify({ error: message, code: "upgrade_required" }),
    { status: 402, headers: { "Content-Type": "application/json" } }
  );
}
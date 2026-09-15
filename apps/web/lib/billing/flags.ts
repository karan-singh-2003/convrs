/**
 * lib/billing/flags.ts
 *
 * Deploy 3b built the billing-UI cutover behind this flag; Deploy 5 (the
 * enforcement flip) turns it on by default. `NEXT_PUBLIC_BILLING_V2` gates the
 * new subscription UI (rebuilt billing page, onboarding billing step,
 * account-level Subscriptions page, "buy Standard vs switch to Growth"
 * decision tree) *and*, in `create-workspace-form.tsx`, whether a new
 * workspace auto-starts a trial on creation (old behavior) or is left
 * uncovered for the user to choose a plan (new behavior — the new billing
 * system controls entitlement instead of the create-workspace form).
 *
 * Default ON: the new architecture is what Deploy 0-4 built and Deploy 3b
 * verified with the flag on (`next build` green both ways). Set
 * `NEXT_PUBLIC_BILLING_V2=false` only to fall back to the pre-Deploy-3b UI and
 * the deprecated `/api/workspaces/[idOrSlug]/billing/upgrade` shim, e.g. while
 * diagnosing a cutover-specific regression.
 *
 * It is a build-time `NEXT_PUBLIC_*` value, so it is safe to read at module
 * scope in both client and server components.
 */
export const BILLING_V2 = process.env.NEXT_PUBLIC_BILLING_V2 !== "false";

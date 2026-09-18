/**
 * lib/billing/flags.ts
 *
 * Deploy 3b built the billing-UI cutover behind this flag; Deploy 5 (the
 * enforcement flip) turns it on by default. `NEXT_PUBLIC_BILLING_V2` gates the
 * new subscription UI (rebuilt `[slug]/billing` page, account-level
 * Subscriptions page, "buy Standard vs switch to Growth" decision tree).
 *
 * There is no onboarding billing step anymore, and it is NOT gated by this
 * flag: onboarding always goes workspace → script → finish, and an eligible
 * user's first *owned* workspace auto-starts the 14-day cardless trial
 * unconditionally, server-side, in `POST /api/workspaces`
 * (`lib/billing/auto-trial.ts`) — regardless of this flag's value.
 *
 * Default ON: the new architecture is what Deploy 0-4 built and Deploy 3b
 * verified with the flag on (`next build` green both ways). Set
 * `NEXT_PUBLIC_BILLING_V2=false` only to fall back to the pre-Deploy-3b
 * dashboard/account billing UI and the deprecated
 * `/api/workspaces/[idOrSlug]/billing/upgrade` shim, e.g. while diagnosing a
 * cutover-specific regression.
 *
 * It is a build-time `NEXT_PUBLIC_*` value, so it is safe to read at module
 * scope in both client and server components.
 */
export const BILLING_V2 = process.env.NEXT_PUBLIC_BILLING_V2 !== "false";

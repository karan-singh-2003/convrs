# Convrs Billing — Implementation Plan

**Date:** 2026-09-07 (last substantive update: 2026-09-16 — Deploy 8, see below)
**Basis:** `docs/billing-architecture-final.md` (approved model). Read that first — this doc does not re-derive the architecture.
**Status:** Deploys 0–5 and 8 done. Deploys 6–7 (legacy-column observation window + drop) outstanding — see Deploy status below, "Final production-readiness pass", and "Deploy 8" immediately after it.

---

## Deploy status

| Deploy | State | Notes |
|---|---|---|
| **0** | ✅ done (2026-09-07) | 36 Dodo products created in **Test Mode**, verified. IDs in `apps/web/scripts/dodo/products.created.json`. |
| **1** | ✅ done (2026-09-07) | Migration `20260907120000_add_subscription_model` (Subscription, DodoWebhookEvent, User.dodoCustomerId, Workspace.subscriptionId/planTier, drop the two Workspace.dodo* uniques). Applied to the dev DB via `db execute` + `migrate resolve`; `prisma generate` run. **On the clean reset (below) it is re-applied from empty by `migrate deploy` like any other migration — no special handling.** |
| **1.5** | ❌ ABANDONED (2026-09-07) | Legacy-data backfill dropped — dev and production data are being **intentionally reset to empty**. `backfill-subscriptions.ts` + its artifacts deleted. No user/workspace/subscription data survives the reset, so there is nothing to migrate. |
| **2** | ✅ done (2026-09-08) | New `lib/billing/*` (plan-resolver, fan-out, subscription-service, webhook-processor, dodo-checkout), webhook rewrite (dedup + transactional + awaited), new `/api/subscriptions*` + `billing/{attach,detach}` + `billing/context` endpoints, repointed billing routes, `entitlement.ts`→`planTier`, migration `20260908000000_growth_subscription_partial_unique` (I-12, verified functionally). 5 legacy files deleted. `tsc --noEmit` clean; 57 tests pass. **No legacy dual-write.** DB **not** reset (done separately). |
| **4** | ✅ done (2026-09-08) | Reconciliation + usage-reset. New `lib/billing/reconcile.ts` (`reconcileBilling()` — retrieves live Dodo state, replays the webhook processor with a synthetic event to self-heal status/product/period/seat drift; handles lapsed cardless trials, stale `canceling` past period end, due `pendingPlanChange`, 404'd Dodo subs, failed `DodoWebhookEvent` replay + 90-day prune) and `lib/billing/usage-reset.ts` (`resetUsageForSubscription` extracted from webhook-processor + shared; `resetLapsedUsagePeriods()` backstop anchored to `currentPeriodStart`). New crons `/api/cron/billing/reconcile` (hourly, `CRON_SECRET`) and `/api/cron/billing/usage-reset` (daily). `vercel.json` updated; **`social/attribution-reconcilation` dir renamed → `attribution-reconciliation`** to match `vercel.json` (pre-existing 404). `subscription.renewed` → usage reset was already wired in Deploy 2. No DB/schema/Dodo-mutation changes (`lastUsageResetAt` already in the schema). Verify: `tsc` clean, `vitest` 81 pass (+15: `decideReconcile` matrix, `dodoSubscriptionToPayload`, `filterDueForReset`), `next build` green, `turbo check-types` 5/5. |
| **3b** | ✅ done (2026-09-08) | UI cutover behind `NEXT_PUBLIC_BILLING_V2` (`apps/web/lib/billing/flags.ts`, default OFF at the time — flipped to default ON in Deploy 5). New: `lib/swr/use-billing-context.ts`, `lib/swr/use-subscriptions.ts`, `lib/billing/plan-compare.ts` (+ test), rebuilt `[slug]/billing` (`billing-v2.tsx` — uncovered decision tree / covered current-plan panel), onboarding `billing` step (`page.tsx` + `form.tsx`), account-level `account/subscriptions` page. Changed (all flag-gated, legacy path byte-identical when off): `use-workspace` exposes the `subscription` object; `create-workspace-form` skips the auto-trial; `create-workspace-modal` + onboarding `workspace/form` route to the billing choice; `upgrade-plan.tsx` hits `/api/subscriptions*`; `free-trial-banner` Growth copy; `workspace-dropdown` coverage badges; `app-sidebar` Subscriptions nav link. No DB / Dodo / schema changes. Verify: `tsc` clean, `vitest` 66 pass, `next build` green with flag OFF **and** ON, `turbo check-types` 5/5. e2e + manual end-to-end were pending the DB reset + a live Dodo test webhook at the time — the final production-readiness pass (below) ran real e2e against a live disposable database and the live Dodo Test Mode API, though not a full hosted-checkout-to-webhook browser flow (see §16). |
| **3a** | ✅ done (2026-09-08) | Pricing catalog + resolver rewiring only (no UI/SWR/DB/migrations/ingestion/crons/Dodo mutations). `packages/utils/.../pricing.tsx` rewritten as the single source of truth: `TierKey` derived from `TIER_KEYS` tuple, `FAMILY_LIMITS`/`TIER_EVENTS`/`TIER_LABEL`/`PRICES` (verbatim from invariants §1) consts, 36 Dodo product IDs inlined, `PlanDetails.tier` machine-identity field added, `getPlanByTier`/`getProductIdByTier` helpers, `isDowngradePlan` price-then-tier-rank tie-break, `formatEventLimit` uncapped→"10M+", `getPlanFromPriceId` deleted. `lib/billing/plan-resolver.ts` repointed from `scripts/dodo/*` → `@repo/utils` (public API unchanged). `billing/upgrade` shim `PLAN_TO_KEY` widened to a superset (raw keys + event labels + legacy marketing names). `dodo-product-audit.ts` gains `--catalog` (offline 3-way cross-check, also gates `--verify`). Verification: `@repo/utils` rebuilt (tsup), `apps/web` `tsc --noEmit` clean, `turbo run check-types` 5/5, `vitest run` 62 pass, `--catalog` PASS, `--verify` 36/36 against live Test-Mode Dodo. |
| **5** | ✅ done (2026-09-14) | Enforcement flip. `lib/billing/flags.ts`: `NEXT_PUBLIC_BILLING_V2` now defaults **ON** (`!== "false"` instead of `=== "true"`) — the new architecture is live by default; the old UI + auto-trial-on-create are reachable only by explicitly setting the flag `false`. `lib/auth/workspace.ts`: removed the per-request trial-expiry flip (§8.9) — it only ever updated the one requesting `Workspace` row, never the owning `Subscription` or sibling workspaces on a Growth trial (a real drift source), and was redundant with the entitlement check below anyway. Seat/workspace-cap enforcement (D11/I-2) was already correctly implemented (Deploy 2's `attachWorkspace` guarded raw SQL) — audited every `Workspace.subscriptionId` write site in Deploy 5 and confirmed none can exceed `maxWorkspaces`; no code change needed there. **D6 implemented and tested**: `isWorkspaceEntitled` (new, `packages/analytics/src/billing-access.ts` — shared so apps/web and apps/ingestion can't drift apart) grants access for `active`, `canceling` (fixes a bug: cancellation-at-period-end was wrongly cutting off access immediately), `trialing` while unexpired, and `past_due` for exactly 7 days from `paymentFailedAt`; wired into `apps/web/lib/billing/entitlement.ts` (delegates), `apps/ingestion/src/controllers/track.ts`, and `track-ai-bot.ts` (the latter two previously only checked `=== "inactive"`, i.e. no grace cap at all — also fixed). Verify: `vitest` 106 pass, `tsc` clean, `next build` green, `turbo check-types` 5/5, plus a new e2e suite (`apps/e2e/tests/billing-enforcement.spec.ts`, 17/17 passing against a live disposable Test-Mode DB) covering the full D6 status matrix and the usage-limit race fix below. |
| **8** | ✅ done (2026-09-16) | **Product decision reversal — see "Deploy 8" below for full detail.** Onboarding billing step removed entirely (`onboarding/(steps)/billing/{page,form,page-deleted}.tsx` deleted; `"billing"` removed from `ONBOARDING_STEPS`); onboarding is now unconditionally `workspace → script → finish`. Automatic 14-day cardless trial **restored** at workspace-creation time — this intentionally reverses the "`POST /api/workspaces` auto-trial removal" half of Deploy 5 — but implemented server-side, transactionally, and idempotently via new `lib/billing/auto-trial.ts`, reusing the same `Serializable`-tx / `User.freeTrialUsedAt` pattern as `start-free-trial/route.ts` (I-14). Eligibility is stricter than the old pre-Deploy-5 behaviour: first **owned** workspace only (`WorkspaceUsers.role = "owner"`; being a member/invitee elsewhere does not count) AND no existing `Subscription` row at all for that user AND `freeTrialUsedAt == null`. `lib/middlewarre/app.ts` now coerces any stale cached `"workspace"` or `"billing"` onboarding-step value to `"script"`, so no code path can ever redirect to `/onboarding/billing`. The real `[slug]/billing` page, `account/subscriptions`, and all other `NEXT_PUBLIC_BILLING_V2`-gated dashboard billing UI are unchanged. Verify: `tsc` clean, `vitest` 553 pass (46 files, +`lib/billing/auto-trial.test.ts`), `next build` green with `/onboarding/billing` absent from the emitted route table. |

### Final production-readiness pass (2026-09-14)

A full audit of the **actual repository** (not just this document) against the flows in `docs/billing-architecture-final.md` and D1–D16, performed after Deploy 5. Found and fixed four genuine implementation bugs, cleaned up the Dodo Test Mode catalog, closed the invoices/payment-methods authorization gap, and added real (not just planned) test coverage. Full detail is inline at each affected section; this is the index.

**Bugs found and fixed:**
1. **Growth→Standard downgrade could silently detach a customer's only workspace.** When exactly one workspace is on the subscription being downgraded, no `keepWorkspaceId` is collected (nothing to choose) — it was left `undefined`, and Prisma drops `undefined` filter values at any nesting depth, so `webhook-processor.ts`'s `id: { not: pending.keepWorkspaceId } }` silently became "no `id` filter at all" once the change took effect, detaching the one workspace meant to survive. Fixed in `subscription-service.ts` (`resolveKeepWorkspaceId` always resolves a real id when one exists) and defensively in `webhook-processor.ts` (`isUnsafeDowngradeDetach` skips the detach — never "detach everyone" — if `keepWorkspaceId` is ever still missing). See §5.2. Unit-tested (`subscription-service.test.ts`, `webhook-processor.test.ts`).
2. **D6 (`past_due` 7-day grace) was unimplemented and the two enforcement points actively contradicted each other**, plus a second bug in the same code: `canceling` subscriptions were denied dashboard/ingestion access immediately, contradicting "access continues until period end." Fixed via one shared `isWorkspaceEntitled` (`packages/analytics/src/billing-access.ts`) used by both apps. See §8.8.
3. **Usage-limit check-then-act race in `track.ts`** — concurrent requests could all pass the cheap early check before any incremented, running `usage` past `usageLimit` with no bound. Fixed with an atomic guarded `updateMany`. See §7.2.
4. **`t10m_plus`'s uncapped-event sentinel (`Number.MAX_SAFE_INTEGER`) overflowed the Postgres `Int` (32-bit) `tierEvents`/`usageLimit` columns** — verified against the dev DB: `Value out of range for the type: ... integer`. This would have crashed *every* checkout, webhook, and fan-out for the top tier (Standard and Growth, both intervals) — one of the 9 self-serve tiers (D13) completely non-functional. Fixed: `UNCAPPED` in `pricing.tsx` is now `2_000_000_000` (Int32-safe, still effectively uncapped for any real customer). See §7.2.

**Authorization fix (invoices / payment-methods / manage):** these routes previously resolved Dodo data from the *viewing session user's own* `dodoCustomerId`, not the workspace's actual subscription owner — the owner saw their own data correctly, but a `billing:read`/`billing:write` team member who isn't the subscription owner silently saw their own (usually empty/unrelated) Dodo data instead of the workspace's real billing. Per D9 (`Subscription.ownerUserId` is authoritative), the fix is **not** to show that non-owner the owner's data (a real cross-customer exposure — it can span every subscription the owner has) but to refuse with a 403 (new `lib/billing/billing-identity.ts`, `requireBillingOwnerDodoCustomerId` / `decideBillingIdentity`, unit-tested) rather than silently show incorrect data. See §8.5.

**Dodo Test Mode catalog cleanup:** the live catalog had 72 active "Convrs"-named products — the current 36 (referenced by `pricing.tsx`) plus two full generations of pre-D3a legacy products (18 from 2026-07-31's old Growth-only ladder, 18 from 2026-04-24/05-04's original flat ladder). Archived all 36 legacy product ids via `client.products.archive()` (Dodo Test Mode, live API); verified checkout against one now returns `422 Product ... does not exist`. Post-cleanup: 36 active, 38 archived (36 + 2 pre-existing), `dodo-product-audit.ts --verify`'s "orphan Convrs products" count is **0**. Every one of the 36 `pricing.tsx` product ids was independently cross-checked (`tier → family → interval → product id → live Dodo product`, matching name AND exact price-in-cents) against the live catalog — 36/36 verified. A repo-wide grep for the 36 legacy ids found exactly one reference, a deliberate negative test (`plan-resolver.test.ts`: `resolvePlanByProductId("pdt_0NdQZEKYFbEhiC2G1iuxI")` must resolve to `null`) — nothing else in the codebase referenced them.

**D10 correction:** an earlier pass of this document said Growth-yearly `t200k` was $590 and marked D10 "confirmed" on that basis — **that was wrong**. The actual shipped product, `pricing.tsx`, `products-spec.ts`, and `docs/billing-invariants.md` §1 all agree: Growth-yearly `t100k` and `t200k` are **both $390, intentionally equal** (the tier-index tie-break in `isDowngradePlan`/`isDowngradeTransition` exists specifically to handle this). Fixed throughout this document (§3.2, §15) and in the one test comment that had inherited the same error.

**Real test coverage added:** `apps/e2e/tests/billing-enforcement.spec.ts` (new) — 17 tests, run against a live disposable Test-Mode database via the existing Playwright e2e harness (not merely planned): the full D6 entitlement matrix (active/canceling/trialing valid+expired/past_due at 0d, 6d, 8d, and no-date/inactive) and the usage-limit race fix (10 concurrent requests against 1 remaining slot → exactly 1 succeeds). Plus `apps/e2e/fixtures/seed.ts`'s new `createBillingTestWorkspace` helper. See §9.5 and §16.

### Deploy 8 — onboarding billing step removed; automatic first-workspace trial restored (2026-09-16)

**This is a deliberate product-decision reversal, not a bug fix.** Deploy 5 (above) explicitly removed the create-time auto-trial so users would pick a plan via a new onboarding billing step ("this is what actually stops create-workspace-form's auto-trial call"; §8.6 used to say "remove nothing here — the auto-trial is in the *form*, not this route"). Deploy 8 reverses that specific decision: there is no onboarding billing step anymore, and an eligible user's first **owned** workspace auto-starts the trial again — but implemented far more strictly than the pre-Deploy-5 version ever was, and entirely server-side.

**Onboarding flow, before → after:**
```
Before: workspace → billing (choose plan / start trial / skip) → script → finish
After:  workspace → script → finish                                                  (unconditional, no flag)
```

**Removed:**
- `app/app.convrs.dev/(onboarding)/onboarding/(steps)/billing/page.tsx`, `form.tsx`, `page-deleted.tsx` — deleted outright, not kept as a compatibility redirect. Confirmed absent from the production route table (`next build` no longer emits `/onboarding/billing`).
- `"billing"` removed from `ONBOARDING_STEPS` (`lib/types.ts`).
- The `NEXT_PUBLIC_BILLING_V2` branch in `workspace/form.tsx` (`continueTo("billing")` vs `continueTo("script")`) — onboarding no longer varies by this flag at all.
- The client-side `startFreeTrial()` fetch + `BILLING_V2` branch in `ui/workspaces/create-workspace-form.tsx` — trial activation is no longer client-initiated in any code path.

**`lib/middlewarre/app.ts`:** the existing "user already has a workspace but the cached onboarding step is stale" redirect used to map `step === "workspace"` → `"billing"`. It now maps both `"workspace"` **and** any leftover cached `"billing"` value (`onboarding-step-cache.ts` has a 24h TTL, so a value written just before this shipped could still be read for up to a day) to `"script"`. There is no remaining code path — fresh or stale-cache — that can produce a redirect to `/onboarding/billing`.

**New: `lib/billing/auto-trial.ts`** — called from `POST /api/workspaces` (§8.6) immediately after the workspace row is created:
- `isAutoTrialEligible()` — pure predicate, unit-tested (`auto-trial.test.ts`): eligible only when **all** of the following hold —
  1. `User.freeTrialUsedAt == null` — the same lifetime flag I-14 already uses; a trial is granted **once per user, ever**, regardless of how many workspaces they later create.
  2. `priorOwnedWorkspaceCount === 0` — counts only `WorkspaceUsers` rows with `role: "owner"` for that user, excluding the workspace just created. Being a **member or invitee** of someone else's workspace (`role: "member" | "viewer" | "billing"`) does **not** count and does **not** disqualify the user's own first creation.
  3. No `Subscription` row at all yet for that user (`ownerUserId` count `=== 0`) — catches a user who already holds a subscription acquired some other way, even one where `freeTrialUsedAt` was somehow never set.
- `grantAutoTrialForNewWorkspace()` — the orchestration, run in its own `Serializable` transaction (mirrors `start-free-trial/route.ts` exactly): re-reads all three eligibility conditions **inside** the transaction (not just trusting a pre-check), creates a `trialing` `Subscription` (`standard`/`t10k`/monthly, cardless — `dodoSubscriptionId: null`, `trialEndsAt = now + 14d`), sets `freeTrialUsedAt = now` in the same tx, attaches `workspace.subscriptionId`, and calls the existing `fanOutSubscription` (§6.4) to populate the denormalized `Workspace` billing fields.
- **Transactional / idempotent / race-safe:** the `Serializable` isolation plus the `freeTrialUsedAt` re-check inside the tx means two concurrent requests for the same user can grant at most one trial — the loser either observes `freeTrialUsedAt` already set or the transaction throws a serialization conflict, which the caller treats as "no trial" and swallows, never retries.
- **Best-effort / never blocks creation:** `POST /api/workspaces` (§8.6) only calls this *after* `prisma.workspace.create` has already succeeded, wrapped in a `try/catch` that logs and swallows any failure. A failed or ineligible grant can never fail the workspace-creation request, and a failed workspace creation can never reach the grant step at all — there is no path to a duplicate or orphaned trial.

**`/[slug]/billing` unaffected:** the real dashboard billing page, `account/subscriptions`, `start-free-trial/route.ts` (still the manual single-workspace path, unchanged), and every other `NEXT_PUBLIC_BILLING_V2`-gated dashboard billing surface continue to work exactly as before — a workspace that didn't qualify for the automatic grant (not the user's first owned workspace, trial already used, or an existing subscription) still reaches `/[slug]/billing` to pick a plan or manage payment normally.

**Not violated:** I-14 ("exactly one free trial per user, lifetime") still holds — Deploy 8 changes *when* and *how automatically* that one trial is offered, never how many a user can get.

Verify: `tsc --noEmit` clean (apps/web + `turbo run check-types` 5/5), `vitest` 553 pass across 46 files (`lib/billing/auto-trial.test.ts` is new), `next build` green with `/onboarding/billing` confirmed absent from the emitted route table.

### Clean-database reset — the new baseline

Dev and production databases are reset to empty, then **`prisma migrate deploy`** replays all 43 migrations in order from scratch. Verified sound:
- migration order has no forward reference — `BillingInterval`/`SubscriptionStatus` enums come from `20260507070441`, `PricingFamily` from `20260731071946`, both before `20260907120000`; the `Workspace_dodo*_key` unique indexes are created by `20260507070441` and dropped by `20260907120000`.
- the pre-existing `20260905000000` drift **disappears** — on a fresh replay it is applied in order (adds `NotificationPreference.trafficSpikeThreshold` **and** the `trafficSpikes` default), so the result matches `./schema` exactly (`prisma migrate diff --from-config-datasource --to-schema` → empty after reset).
- `prisma migrate dev` / `migrate reset` are **usable again** post-reset (no drift). `SHADOW_DATABASE_URL` is still unset, so authoring *new* migrations needs a shadow DB or the `db execute` + `migrate resolve` pattern.

Reset procedure (run from `packages/db`, `DATABASE_URL` pointed at the target):
```
# dev
prisma migrate reset --force          # drop schema → migrate deploy all 43 → seed (if configured)
# production (or any DB where reset must not run seed / must be explicit)
#   drop & recreate the database, then:
prisma migrate deploy
prisma generate
```

**The Deploy-1 `findUnique({where:{dodoCustomerId}})` compile break in `subscription-active.ts` is resolved by Deploy 2** (that file is deleted). `pnpm --filter web build` stays red between Deploy 1 and Deploy 2 — expected.

### Deploy 2 — revised for clean slate

Supersedes §5–§8 where they differ. Everything else in §5–§8 stands.

**Changes vs the original plan:**

1. **No legacy dual-write.** The original `fanOutLegacyColumns()` + `BILLING_LEGACY_DUAL_WRITE` flag existed only to keep Deploys 2–5 revertible against *production data*. With a clean reset there is no data to protect, so Deploy 2's webhook writes **only**: the new `Subscription` row + the **permanent** denormalized cache on each attached `Workspace` — `{ subscriptionStatus, planFamily, planTier, tierEvents, usageLimit, currentPeriodEnd, freeTrialEndDate, paymentFailedAt }` (the I-8 fields). The legacy `Workspace` columns `plan` (enum), `dodoCustomerId`, `dodoSubscriptionId`, `billingInterval` are **never written** by the new code — they stay at their defaults and are dropped in Deploy 7. `fanOutLegacyColumns` and `legacyEnumFor()` are **not built**.
2. **`entitlement.ts` reads `planTier`, not `plan`.** Because `Workspace.plan` (enum) is no longer maintained, Deploy 2 changes `workspaceHasSocialAttribution` (and any other reader in scope) to use `workspace.planTier` + `workspace.planFamily`. `getPlanDetails({ plan: … })` call sites switch to a `planTier`-keyed lookup.
3. **I-12 partial unique index lands with the reset.** A new migration `20260908000000_growth_subscription_partial_unique` is added to the folder **now** so the clean `migrate deploy` applies it before any data exists:
   ```sql
   CREATE UNIQUE INDEX "one_active_growth_per_user"
     ON "Subscription" ("ownerUserId")
     WHERE "planFamily" = 'growth' AND "status" NOT IN ('canceled', 'expired');
   ```
   (Prisma's schema DSL can't express a partial unique index; it is a hand-authored migration. The `Subscription` model gets a `/// @@index note` comment only.)
4. **No `subscription-active.ts` patch.** Deploy 2 deletes `subscription-active.ts` / `subscription-updated.ts` / `subscription-cancelled.ts` / `webhook/utils/update-worksapce-plan.ts` / `lib/billing/apply-subscription.ts`, which resolves the Deploy-1 compile break outright.
5. **`plan-resolver.ts` data source.** Until Deploy 3 wires the 36 IDs into `pricing.tsx`, `plan-resolver.ts` resolves `product_id → { family, tier, events }` from `apps/web/scripts/dodo/products-spec.ts` (`PRODUCT_SPECS`) + `products.created.json`. Deploy 3 repoints it at `pricing.tsx`.
6. **`past_due` grace (D6), `withWorkspace` trial-flip removal, `POST /api/workspaces` auto-trial removal, seat-cap enforcement** stayed in **Deploy 5** as originally planned — Deploy 2 introduced the `isEntitled()` helper returning that era's behaviour (`active` or valid `trialing`); Deploy 5 (now done — see status table) is what added `canceling`/`past_due` grace to it.
7. **Deploy 1.5 (backfill) abandoned, not built.** `apps/web/scripts/dodo/backfill-subscriptions.ts` and `apps/web/scripts/dodo/backfill-plan/` were never shipped and are deleted from the plan — see §4, which is now a historical note rather than a spec.

**Deploy 2 file list (revised):**

*New:*
- `packages/db/schema/migrations/20260908000000_growth_subscription_partial_unique/migration.sql`
- `apps/web/lib/billing/plan-resolver.ts`
- `apps/web/lib/billing/fan-out.ts` — `fanOutSubscription(subscriptionId, tx)` + `INACTIVE_BASELINE`
- `apps/web/lib/billing/subscription-service.ts` — create / changePlan / cancel / resume / attach / detach / consolidateStandardSubs
- `apps/web/lib/billing/webhook-processor.ts` — `processWebhookEvent`
- `apps/web/lib/billing/dodo-checkout.ts`
- `apps/web/lib/zod/schemas/subscriptions.ts`
- `apps/web/app/api/subscriptions/route.ts` (POST create, GET list)
- `apps/web/app/api/subscriptions/[id]/change-plan/route.ts`
- `apps/web/app/api/subscriptions/[id]/cancel/route.ts`
- `apps/web/app/api/subscriptions/[id]/resume/route.ts`
- `apps/web/app/api/workspaces/[idOrSlug]/billing/attach/route.ts`
- `apps/web/app/api/workspaces/[idOrSlug]/billing/detach/route.ts`
- `apps/web/app/api/billing/context/route.ts`
- tests: `apps/web/lib/billing/{plan-resolver,fan-out,subscription-service}.test.ts`, `apps/web/app/api/dodo/webhook/webhook-processor.test.ts`

*Rewritten:*
- `apps/web/app/api/dodo/webhook/route.ts` — dedup (`DodoWebhookEvent`), single `$transaction`, awaited (drop fire-and-forget), delegates to `webhook-processor`
- `apps/web/app/api/workspaces/[idOrSlug]/billing/manage/route.ts` — portal from `user.dodoCustomerId`
- `.../billing/route.ts` — read `workspace.subscription`
- `.../billing/invoices/route.ts`, `.../billing/payment-methods/route.ts` — Dodo query by `user.dodoCustomerId`
- `.../billing/start-free-trial/route.ts` — create a `trialing` `Subscription`
- `apps/web/lib/billing/entitlement.ts` — `planTier` + `isEntitled()`
- `apps/web/lib/billing/social-eligibility.ts` — add `status ∈ {active,trialing}` to the `where`
- `apps/web/lib/api/workspaces/delete-workspace.ts` — `detachWorkspace` + drop the Stripe `cancelSubscription` misuse
- `apps/web/lib/api/workspaces/check-subscription-status.ts` — via `isEntitled()`
- `apps/web/lib/types.ts` — `WorkspaceProps`: add `subscription`, `subscriptionId`, `planTier`
- `apps/web/lib/zod/schemas/workspaces.ts` — drop phantom `stripe*`/`billingCycleStart`/`planTier(number)`; add `subscription`, `subscriptionId`, `planTier(string)`

*Deleted:*
- `apps/web/app/api/dodo/webhook/subscription-active.ts`, `subscription-updated.ts`, `subscription-cancelled.ts`, `webhook/utils/update-worksapce-plan.ts`
- `apps/web/lib/billing/apply-subscription.ts`

*Kept as a shim (deleted in Deploy 7):* `apps/web/app/api/workspaces/[idOrSlug]/billing/upgrade/route.ts` — forwards to the new endpoints until Deploy 3's UI stops calling it.

**Deploy 2 does NOT touch:** `pricing.tsx`, any UI component, SWR hooks, `lib/auth/workspace.ts`, `POST /api/workspaces`, `apps/ingestion/*`, cron routes.

---

## 0. Conventions used in this plan

- **Deploy N** = a shippable, independently-revertible release. There are 7.
- **Legacy columns** = `Workspace.dodoCustomerId`, `Workspace.dodoSubscriptionId`, `Workspace.billingInterval`, `Workspace.plan` — **not dual-written** (no legacy data to protect on a clean reset, see "Clean-database reset" and "Deploy 2 — revised for clean slate" above); they sit at their defaults from Deploy 2 onward and are dropped in Deploy 7.
- **Fan-out** = `fanOutSubscription(subscriptionId, tx)` — the single function that copies `Subscription` state onto every attached `Workspace`.
- **Product decisions** D1–D16 from the architecture doc. **D13 is confirmed: all 9 tiers are self-serve checkout** — no sales-led/"Contact us" gating (see §15), matching what Deploy 0/3a already shipped (all 36 products created and wired). **D10 is confirmed: Growth yearly `t100k` and `t200k` are BOTH $390, intentionally equal** — not $590 (§15; this corrects an error introduced in an earlier pass of this document, since fixed and verified against the live Dodo catalog and the actual `pricing.tsx`/`products-spec.ts`/`billing-invariants.md` source of truth).
- **No backfill / no legacy migration.** Deploy 1.5 (backfill) was abandoned — dev and production databases are reset to empty instead of migrated. Nothing in this plan should be read as reintroducing a migration step under another name. This is a clean-start billing implementation, not a legacy billing migration.
- Tier keys are the **new** event sizes: `t10k, t100k, t200k, t500k, t1m, t2m, t5m, t10m, t10m_plus`.

---

## 1. Dependency graph / order of operations

```
Deploy 0  Prerequisites (no code deploy)  ── ✅ done
          ├── Resolve D1–D16   (D10 confirmed — Growth yearly t100k = t200k = $390; D13 confirmed — all 9 tiers self-serve)
          ├── Create 36 Dodo products (test + live)      §3
          └── scripts/dodo-product-audit.ts               §3
                    │
Deploy 1  Additive schema  (§2)  ── zero behaviour change, old webhook still runs  ── ✅ done
          ├── Subscription, DodoWebhookEvent models
          ├── User.dodoCustomerId
          ├── Workspace.subscriptionId + Workspace.planTier
          └── Invoice.workspace onDelete  (D14, non-blocking — may still be unconfirmed)
                    │
Deploy 1.5 ❌ ABANDONED — no backfill. Databases are reset to empty instead (see
          "Clean-database reset" above); there is no legacy data to migrate.
                    │
Deploy 2  New write path  (§5, §6, §7, §8)  ── ✅ done, revised for clean slate (see above)
          ├── lib/billing/{plan-resolver,fan-out,subscription-service,webhook-processor,dodo-checkout}.ts
          ├── Rewrite /api/dodo/webhook  (dedup + transactional, awaited — no legacy dual-write)
          ├── New endpoints: /api/subscriptions*, /api/workspaces/[id]/billing/{attach,detach}, /api/billing/context
          ├── Repoint /api/workspaces/[id]/billing/{manage,invoices,payment-methods,route,start-free-trial}
          └── entitlement.ts / social-eligibility.ts add status check
                    │
Deploy 3  Frontend cutover  (§9)   ── flag NEXT_PUBLIC_BILLING_V2  ── ✅ done (as 3a + 3b, see status table)
          ├── pricing.tsx new tiers/prices/product-ids/FAMILY_LIMITS  (§3)
          ├── create-workspace flow (intent), onboarding billing step, billing page, pricing card
          ├── Account-level Subscriptions page
          └── SWR hooks + WorkspaceSchema cleanup
                    │
Deploy 4  Reconciliation + usage reset  (§10, §7)  ── ✅ done
          ├── /api/cron/billing/reconcile  + vercel.json
          └── /api/cron/billing/usage-reset + vercel.json  + subscription.renewed hook
                    │
Deploy 5  Enforcement flip  (§8, D6)  ── ✅ done (see status table)
          ├── NEXT_PUBLIC_BILLING_V2 default flipped ON (was opt-in, now opt-out) —
          │     this is what actually stops create-workspace-form's auto-trial call
          ├── hasWorkspaceAccess + track.ts + track-ai-bot.ts unified past_due grace
          │     via shared @repo/analytics isWorkspaceEntitled (also fixes: "canceling"
          │     was wrongly denying access; track.ts/track-ai-bot.ts had NO grace cap at all)
          ├── removed withWorkspace per-request trial flip (Subscription-keyed
          │     reconcile cron / webhook is the sole writer of the cached status now)
          └── seat caps: audited every Workspace.subscriptionId write site — all
                already go through the Deploy 2 attachWorkspace guard or attach
                exactly 1 workspace to a brand-new subscription; no gap found
                    │
Deploy 6  Observation window before dropping legacy (already-unwritten) columns — not yet started
                    │
Deploy 7  Drop legacy columns + delete dead code  (§2.4, §14)  ── not yet started

Deploy 8  Onboarding billing step removed; automatic first-workspace trial
          restored  (§8.6, §11)  ── ✅ done (2026-09-16) — independent of 6/7,
          REVERSES part of Deploy 5's decision (see "Deploy 8" narrative above)
          ├── Deleted onboarding/(steps)/billing/{page,form,page-deleted}.tsx —
          │     onboarding is now workspace → script → finish, unconditionally,
          │     not gated by NEXT_PUBLIC_BILLING_V2
          ├── Removed the BILLING_V2 branch from workspace/form.tsx and the
          │     client-side startFreeTrial() call from create-workspace-form.tsx
          ├── lib/middlewarre/app.ts: stale cached "workspace"/"billing" onboarding
          │     steps now coerce to "script" — no path can redirect to
          │     /onboarding/billing, fresh or from a pre-Deploy-8 cache entry
          └── New lib/billing/auto-trial.ts: POST /api/workspaces auto-grants the
                14-day cardless trial to an eligible user's first OWNED workspace
                (member/invitee elsewhere doesn't count), server-side, inside a
                Serializable transaction, idempotent — reuses the I-14 pattern
```

**Note:** the original plan's "hard rule" that Deploy 2's webhook must dual-write into the legacy `Workspace.dodo*`/`plan`/`planFamily` columns to keep Deploy 2–5 revertible **does not apply**. On a clean reset there is no legacy data to protect (see "Deploy 2 — revised for clean slate" above): the legacy columns are simply never written from Deploy 2 onward. Deploy 6's role is now just a confidence/observation window before Deploy 7 drops those already-dormant columns, not a "stop dual-writing" step.

---

## 2. Prisma / schema changes and migration sequence

All schema lives in `packages/db/schema/*.prisma` (multi-file). Migrations via `pnpm --filter web prisma:migrate` (dotenv-flow wrapped). Never `db push` — see `packages/db/CLAUDE.md`.

### 2.1 Migration 1 — `add_subscription_model` (Deploy 1, additive only)

**`packages/db/schema/workspace.prisma`** — add two models + FK on `Workspace`:

```prisma
model Subscription {
  id                 String   @id @default(cuid())

  ownerUserId        String
  owner              User     @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)

  dodoSubscriptionId String?  @unique
  dodoCustomerId     String?
  dodoProductId      String?

  planFamily         PricingFamily          // existing enum (standard | growth)
  planTier           String                 // "t10k".."t10m_plus"
  tierEvents         Int
  billingInterval    BillingInterval?       // existing enum (month | year)
  currency           String   @default("USD")

  status             SubscriptionStatus @default(inactive)   // existing enum

  maxWorkspaces      Int
  workspaceCount     Int      @default(0)

  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  trialEndsAt        DateTime?
  cancelAtPeriodEnd  Boolean  @default(false)
  paymentFailedAt    DateTime?
  pendingPlanChange  Json?

  lastEventAt        DateTime?
  lastWebhookId      String?
  welcomeEmailSentAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspaces Workspace[]

  @@index([ownerUserId])
  @@index([status])
  @@index([dodoSubscriptionId])
  @@index([currentPeriodEnd])          // reconciliation cron scans this
}

model DodoWebhookEvent {
  webhookId          String   @id
  eventType          String
  dodoSubscriptionId String?
  status             String   @default("processing")   // processing | done | failed
  attempts           Int      @default(0)
  error              String?
  receivedAt         DateTime @default(now())
  processedAt        DateTime?

  @@index([dodoSubscriptionId])
  @@index([status])
  @@index([receivedAt])                // pruning
}
```

Add to `model Workspace` (keep every existing field):

```prisma
  subscriptionId String?
  subscription   Subscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)
  planTier       String?        // denormalized; nullable during transition
  @@index([subscriptionId])
```

**`packages/db/schema/schema.prisma`** — add to `model User`:

```prisma
  dodoCustomerId String?        @unique
  subscriptions  Subscription[]
```

**`packages/db/schema/invoice.prisma`** (D14 — pre-existing bug, bundle here): change

```prisma
  workspace  Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
```

Choose `Cascade` vs `SetNull` per D14 confirmation. **If unconfirmed at Deploy 1, split this into its own migration and defer** — do not block the billing work on it.

**Properties:** purely additive. No column dropped, no NOT NULL added to existing data, no default changed. Old webhook code (`subscription-active.ts` etc.) keeps compiling and running against the legacy columns. Zero downtime.

**Command:**
```
cd apps/web
pnpm prisma:generate
pnpm exec dotenv-flow -e .env -- pnpm --filter @repo/db prisma:migrate -- --name add_subscription_model
# review generated SQL in packages/db/schema/migrations/<ts>_add_subscription_model/migration.sql
pnpm prisma:push   # staging first
```

Regenerate the client for all consumers (`apps/web`, `apps/ingestion`, `packages/analytics`): `pnpm build:packages` or targeted `pnpm --filter @repo/db build`.

### 2.2 Migration 2 — `drop_workspace_billing_uniques` (Deploy 7 only)

```sql
ALTER TABLE "Workspace" DROP CONSTRAINT IF EXISTS "Workspace_dodoCustomerId_key";
DROP INDEX IF EXISTS "Workspace_dodoCustomerId_idx";
ALTER TABLE "Workspace" DROP CONSTRAINT IF EXISTS "Workspace_dodoSubscriptionId_key";
DROP INDEX IF EXISTS "Workspace_dodoSubscriptionId_idx";
ALTER TABLE "Workspace" DROP COLUMN "dodoCustomerId";
ALTER TABLE "Workspace" DROP COLUMN "dodoSubscriptionId";
ALTER TABLE "Workspace" DROP COLUMN "billingInterval";
-- keep "plan" column one more release unless every read is migrated to planTier
```

Prisma will also drop `@@index([dodoSubscriptionId])`, `@@index([dodoCustomerId])` from the model.

### 2.3 Enum notes

- **Reuse** `SubscriptionStatus`, `BillingInterval`, `PricingFamily` — do not rename (widely referenced).
- **`WorkspacePlan` enum**: per D3 it is superseded by `planTier: String` as the authoritative tier identifier. Do **not** drop the enum column in this project (dropped in Deploy 7 alongside the other legacy columns) — but it is **not** dual-written or backfilled; it simply stays at its default from Deploy 2 onward. New code reads `planTier` exclusively.

### 2.4 Dead schema/code removed at Deploy 7

- `packages/db/schema/payment.prisma:1-34` commented block, `stripe.prisma:1-11` commented block (cleanup, optional).
- Nothing else structural.

---

## 3. Dodo product / price mapping (D16 — launch blocker)

### 3.1 Current state

`packages/utils/src/constants/pricing/pricing.tsx` holds `STANDARD_PRODUCT_IDS` and `GROWTH_PRODUCT_IDS`, each 9 tiers × {monthly, yearly} = **36 product IDs already referenced**, but they point at products whose **event tiers and prices do not match the approved model** (old ladder: 10k/25k/100k/500k/1M/5M/10M/15M/25M; old Growth prices are explicitly labelled "placeholders").

### 3.2 Required: create 36 Dodo subscription products (test **and** live)

Every row below is a **new product** (recurring subscription). Do not attempt to re-price existing products — the tier semantics changed.

| # | family | tier key | events | interval | price (USD) | pricing.tsx path |
|---|---|---|---|---|---|---|
| 1 | standard | t10k | 10,000 | month | $9 | `STANDARD_PRODUCT_IDS.t10k.monthly` |
| 2 | standard | t10k | 10,000 | year | $90 | `.t10k.yearly` |
| 3 | standard | t100k | 100,000 | month | $19 | `.t100k.monthly` |
| 4 | standard | t100k | 100,000 | year | $190 | `.t100k.yearly` |
| 5 | standard | t200k | 200,000 | month | $29 | `.t200k.monthly` |
| 6 | standard | t200k | 200,000 | year | $290 | `.t200k.yearly` |
| 7 | standard | t500k | 500,000 | month | $49 | `.t500k.monthly` |
| 8 | standard | t500k | 500,000 | year | $490 | `.t500k.yearly` |
| 9 | standard | t1m | 1,000,000 | month | $69 | `.t1m.monthly` |
| 10 | standard | t1m | 1,000,000 | year | $690 | `.t1m.yearly` |
| 11 | standard | t2m | 2,000,000 | month | $89 | `.t2m.monthly` |
| 12 | standard | t2m | 2,000,000 | year | $890 | `.t2m.yearly` |
| 13 | standard | t5m | 5,000,000 | month | $129 | `.t5m.monthly` |
| 14 | standard | t5m | 5,000,000 | year | $1,290 | `.t5m.yearly` |
| 15 | standard | t10m | 10,000,000 | month | $169 | `.t10m.monthly` |
| 16 | standard | t10m | 10,000,000 | year | $1,690 | `.t10m.yearly` |
| 17 | standard | t10m_plus | 10,000,000+ | month | $199 | `.t10m_plus.monthly` |
| 18 | standard | t10m_plus | 10,000,000+ | year | $1,990 | `.t10m_plus.yearly` |
| 19 | growth | t10k | 10,000 | month | $19 | `GROWTH_PRODUCT_IDS.t10k.monthly` |
| 20 | growth | t10k | 10,000 | year | $190 | `.t10k.yearly` |
| 21 | growth | t100k | 100,000 | month | $39 | `.t100k.monthly` |
| 22 | growth | t100k | 100,000 | year | $90 | `.t100k.yearly` |
| 23 | growth | t200k | 200,000 | month | $59 | `.t200k.monthly` |
| 24 | growth | t200k | 200,000 | year | $590 (intentionally == row 22, D10) | `.t200k.yearly` |
| 25 | growth | t500k | 500,000 | month | $99 | `.t500k.monthly` |
| 26 | growth | t500k | 500,000 | year | $990 | `.t500k.yearly` |
| 27 | growth | t1m | 1,000,000 | month | $139 | `.t1m.monthly` |
| 28 | growth | t1m | 1,000,000 | year | $1,390 | `.t1m.yearly` |
| 29 | growth | t2m | 2,000,000 | month | $179 | `.t2m.monthly` |
| 30 | growth | t2m | 2,000,000 | year | $1,790 | `.t2m.yearly` |
| 31 | growth | t5m | 5,000,000 | month | $259 | `.t5m.monthly` |
| 32 | growth | t5m | 5,000,000 | year | $2,590 | `.t5m.yearly` |
| 33 | growth | t10m | 10,000,000 | month | $339 | `.t10m.monthly` |
| 34 | growth | t10m | 10,000,000 | year | $3,390 | `.t10m.yearly` |
| 35 | growth | t10m_plus | 10,000,000+ | month | $399 | `.t10m_plus.monthly` |
| 36 | growth | t10m_plus | 10,000,000+ | year | $3,990 | `.t10m_plus.yearly` |

**Per product, set in the Dodo dashboard:**
- Type: recurring subscription, billing period = month or year per the row.
- Price: exact figure above, USD. (Localised pricing / adaptive currency — separate, out of scope; `Subscription.currency` records whatever Dodo bills.)
- Name convention: `Convrs <Standard|Growth> — <events> / <mo|yr>`.
- Metadata on the product (optional, aids the audit script): `{ family, tier, events, interval }`.
- **No `trial_period_days` on the product** — trials are injected per-checkout via `subscription_data.trial_period_days` (§8.4).
- **D13 (confirmed): all 9 tiers, including `t5m`/`t10m`/`t10m_plus`, are self-serve checkout** — no "Contact us"/sales-led path. This matches what Deploy 0 already shipped (all 36 products created) and what Deploy 3a already wired into `pricing.tsx` with no tier gating.

### 3.3 `scripts/dodo-product-audit.ts` (Deploy 0)

- Reads `PRICING_FAMILIES` from `@repo/utils`.
- Calls `dodo.products.list()` (paginate).
- For every `(family, tier, interval)` asserts: a product ID is set in `pricing.tsx`, the product exists in Dodo, its `price` matches the table, its `payment_frequency_interval` matches, its recurring flag is set.
- Exit non-zero on any mismatch. Run in CI (add a `check` script) and manually before Deploy 3.
- Run against **both** `DODO_PAYMENTS_ENVIRONMENT=test_mode` and `live_mode`.

### 3.4 `pricing.tsx` rewrite (Deploy 3)

- Replace the 9 `STANDARD_PLANS` / `GROWTH_PLANS` entries: new `name` (use tier key or a display label like `"100K"`), `limits.events` per table, `price.monthly`/`price.yearly` per table, `price.ids` = the new product IDs.
- `t10m_plus`: `limits.events = Number.MAX_SAFE_INTEGER` (sentinel). `formatEventLimit` gets a `>= MAX_SAFE_INTEGER → "10M+ events/mo"` branch.
- Add `export const FAMILY_LIMITS: Record<PricingFamily, number> = { standard: 1, growth: 30 };`
- Keep `getPlanFromProductId`, `getProductId`, `getPlanDetails`, `isDowngradePlan`, `getNextPlan`, `formatEventLimit` signatures. `getPlanFromProductId` must now also return `tierKey`.
- Delete the `getPlanFromPriceId = getPlanFromProductId as unknown as (...)` double-cast (engineering-audit finding).
- Update the collision-warning comment block (tier named "Growth" is gone).
- `SELF_SERVE_PLANS` / named exports (`Growth_Plan` etc.) — grep for consumers first (`ui/upgrade-plan*`, onboarding). Replace with `PRICING_FAMILIES.standard[n]` references or keep thin aliases.

---

## 4. Backfill of existing billing data — ABANDONED / HISTORICAL

**Deploy 1.5 (backfill) was abandoned on 2026-09-07 and was never built.** This section is kept only as a historical record of the rejected approach — it is **not** a spec for any future deployment. Do not resurrect any part of it under another name.

**Current decision:** dev and production databases are reset to empty (see "Clean-database reset — the new baseline" above) instead of having existing billing data migrated. There is no `WorkspacePlan → planTier` backfill map, no Dodo-customer-record migration, no subscription/invoice migration, no Enterprise/Ultimate legacy-customer mapping, and no `dodo_customer_conflicts.csv` reconciliation. None of it is needed because no user/workspace/subscription data survives the reset.

The original draft of this plan (now removed) described a one-shot `scripts/backfill-subscriptions.ts` (dry-run first, then `--commit`), a tier-mapping table from the old `WorkspacePlan` enum to the new `planTier` values, a Dodo-customer-conflict process for users with split Dodo customers, a `scripts/backfill-verify.ts` assertion pass, and a `scripts/rollback-subscriptions.ts` rollback path. **None of that was built and none of it should be.** `apps/web/scripts/dodo/backfill-subscriptions.ts` and `apps/web/scripts/dodo/backfill-plan/` do not exist in the codebase and are not on the roadmap.

---

## 5. Subscription lifecycle operations (`lib/billing/subscription-service.ts`)

New module. Pure functions + Prisma; all Dodo calls isolated in `lib/billing/dodo-checkout.ts` and here.

### 5.1 `createSubscriptionCheckout({ ownerUserId, intent, tierKey, interval, targetWorkspaceId?, consolidateStandardSubIds? })`

1. Validate: `intent ∈ {"standard","growth"}`; `tierKey` valid; caller owns `targetWorkspaceId` and it is uncovered (`subscriptionId = null`).
2. `productId = getProductId({ family: intent, tier: tierKey, interval })` → 400 if null.
3. Create the internal `Subscription` row **now**: `status = "inactive"`, `dodoSubscriptionId = null`, `planFamily = intent`, `planTier`, `tierEvents`, `maxWorkspaces = FAMILY_LIMITS[intent]`, `ownerUserId`, `pendingPlanChange = { consolidateStandardSubIds }` if present.
4. Trial eligibility (§11): `trialDays = user.freeTrialUsedAt ? null : 14` (or remaining-days if converting an existing cardless trial sub — see §8.4).
5. `dodo.checkoutSessions.create({ product_cart: [{ product_id: productId, quantity: 1 }], customer: <existing-or-new, §8.3>, metadata: { internalSubscriptionId, ownerUserId, targetWorkspaceId ?? "", intent }, subscription_data: trialDays ? { trial_period_days: trialDays } : undefined, return_url })`.
6. Return `{ checkoutUrl, internalSubscriptionId }`.

### 5.2 `changePlan({ subscriptionId, targetFamily, targetTierKey, targetInterval, actorUserId })`

1. Load `Subscription`; assert `actorUserId === ownerUserId`; assert `status ∈ {active, trialing, past_due}`; assert `dodoSubscriptionId != null`.
2. Reject no-op (same family+tier+interval).
3. Determine transition class:
   - **tier up, same family** → `proration_billing_mode: "prorated_immediately"`, `effective_at: "immediately"`.
   - **tier down, same family** → `proration_billing_mode: "do_not_bill"` (D4) — applies at renewal. Store `pendingPlanChange = { effectiveAt: currentPeriodEnd, targetFamily, targetTierKey, targetInterval }`.
   - **standard → growth** (Scenario 3) → `prorated_immediately`, `immediately`; on success set `planFamily = growth`, `maxWorkspaces = 30` locally; fan out.
   - **growth → standard** (Scenario 7) → **gated**: caller must pass `keepWorkspaceId` and the endpoint must have received an explicit acknowledgement; `proration_billing_mode: "do_not_bill"`; store `pendingPlanChange = { effectiveAt: currentPeriodEnd, targetFamily: "standard", targetTierKey, targetInterval, keepWorkspaceId }`. Do **not** change `maxWorkspaces` or detach anything yet.
4. `dodo.subscriptions.changePlan(dodoSubscriptionId, { product_id, quantity: 1, proration_billing_mode, ... })`. Map Dodo errors (reuse the `mapDodoError` helper from the current `billing/upgrade/route.ts`).
5. On success, for immediate transitions: local `Subscription.update` + `fanOutSubscription` in one tx. For scheduled transitions: only write `pendingPlanChange`.
6. The `subscription.plan_changed` / `subscription.updated` webhook confirms (idempotent).

### 5.3 `cancelSubscription({ subscriptionId, actorUserId, mode })`  — `mode: "at_period_end" | "immediately"`

1. Assert ownership + `dodoSubscriptionId != null`.
2. **If Growth with `workspaceCount > 1`:** the endpoint must return the list of affected workspaces and require an `acknowledgeWorkspaceIds` echo before proceeding (UI shows "this deactivates all N sites on <date>").
3. `dodo.subscriptions.update(dodoSubscriptionId, { cancel_at_next_billing_date: true })` (at period end) or `dodo.subscriptions.cancel(...)` (immediate).
4. Local: `status = "canceling"` (at period end) or handled by webhook (`immediately` → `subscription.cancelled`/`expired`).
5. `resumeSubscription` = `dodo.subscriptions.update(..., { cancel_at_next_billing_date: false })`, local `status = "active"`, `cancelAtPeriodEnd = false`.

### 5.4 `attachWorkspace({ workspaceId, subscriptionId, actorUserId })` (Scenario 5)

Raw SQL guarded claim (Prisma can't compare two columns):
```sql
UPDATE "Subscription"
SET "workspaceCount" = "workspaceCount" + 1, "updatedAt" = now()
WHERE "id" = $subId
  AND "ownerUserId" = $actor
  AND "status" IN ('active','trialing')
  AND "workspaceCount" < "maxWorkspaces"
RETURNING "id";
```
- 0 rows → `409 { code: "seat_limit_or_inactive" }`.
- 1 row → `prisma.workspace.update({ where: { id: workspaceId, subscriptionId: null }, data: { subscriptionId } })` then `fanOutSubscription(subscriptionId, tx)` (all in one tx; if the workspace update matches 0 rows because it's already covered, roll back and decrement).

### 5.5 `detachWorkspace({ workspaceId, actorUserId, reason })`

1. Load workspace + its `Subscription`; assert actor owns the subscription (or is workspace owner).
2. Tx: `workspace.update({ subscriptionId: null, + inactive/free cache baseline })`; `Subscription.workspaceCount = (SELECT count(*) FROM "Workspace" WHERE "subscriptionId" = $subId)` (recompute, not decrement).
3. If the sub is Standard and now `workspaceCount = 0` (D5): call `cancelSubscription({ mode: "at_period_end" })` + notify owner.

### 5.6 `consolidateStandardSubs({ growthSubscriptionId, standardSubIds, actorUserId })` (Scenario 4)

Called from the webhook processor when a Growth `subscription.active` carries `pendingPlanChange.consolidateStandardSubIds`, **or** from `changePlan` for the multi-sub case:
1. Validate total workspaces across growth + all standard subs ≤ 30.
2. Tx: re-point every `Workspace` from the standard subs → growth sub; recompute `growthSub.workspaceCount`; set each standard sub `status = "canceling"`, `workspaceCount = 0`; `fanOutSubscription(growthSub)`.
3. **After** the tx: `dodo.subscriptions.update(each standard dodoSubscriptionId, { cancel_at_next_billing_date: true })`. Failure → structured log + row in `billing_reconcile_queue` (picked up by §10 cron) + alert. Never leave silently double-billed.

---

## 6. Webhook architecture

### 6.1 Files

| Path | Action |
|---|---|
| `apps/web/app/api/dodo/webhook/route.ts` | **Rewrite** (§6.2) |
| `apps/web/app/api/dodo/webhook/subscription-active.ts` | Delete; logic → `webhook-processor.ts` |
| `apps/web/app/api/dodo/webhook/subscription-updated.ts` | Delete |
| `apps/web/app/api/dodo/webhook/subscription-cancelled.ts` | Delete |
| `apps/web/app/api/dodo/webhook/utils/update-worksapce-plan.ts` | Delete (already dead) |
| `apps/web/lib/billing/apply-subscription.ts` | Replace with `webhook-processor.ts` + `fan-out.ts` |
| `apps/web/lib/billing/webhook-processor.ts` | **New** |
| `apps/web/lib/billing/fan-out.ts` | **New** |
| `apps/web/lib/billing/plan-resolver.ts` | **New** (thin wrapper over `getPlanFromProductId`) |
| `apps/web/lib/dodo/types.ts` | Extend payload types; add checkout-session + `metadata` types |

### 6.2 `route.ts` — request handling

```
POST /api/dodo/webhook
1. rawBody = await req.text()
2. event = dodo.webhooks.unwrap(rawBody, { headers: { webhook-id, webhook-signature, webhook-timestamp } })
     └─ throws → return 401 "Invalid signature"   (unchanged)
3. webhookId = header "webhook-id"
4. dedup:
     const { count } = await prisma.dodoWebhookEvent.createMany({
       data: [{ webhookId, eventType: event.type, dodoSubscriptionId: subIdOf(event), status: "processing" }],
       skipDuplicates: true,
     });
     if (count === 0) {
       const row = await prisma.dodoWebhookEvent.findUnique({ where: { webhookId } });
       if (row.status === "done") return 200;
       if (row.status === "processing" && Date.now() - row.receivedAt < 15_000) return 200;
       // stale processing / failed → fall through, reprocess (safe: idempotent)
       await prisma.dodoWebhookEvent.update({ where: { webhookId }, data: { attempts: { increment: 1 } } });
     }
5. if (!RELEVANT_EVENTS.has(event.type)) {
     await markDone(webhookId); return 200;
   }
6. try {
     await processWebhookEvent(event, webhookId);   // §6.3 — AWAITED, transactional
     return 200;
   } catch (err) {
     await prisma.dodoWebhookEvent.update({ where: { webhookId }, data: { status: "failed", error: String(err) } });
     return 500;   // Dodo retries (≤8×, exp backoff)
   }
```

**Removed:** the current `const response = NextResponse.json(...); processWebhookAsync(event).catch(...); return response;` fire-and-forget. Processing is now awaited. The transaction body is small (a few writes + one `updateMany`) — well under Dodo's 15s window.

`RELEVANT_EVENTS` = `{ subscription.active, subscription.updated, subscription.renewed, subscription.plan_changed, subscription.on_hold, subscription.cancelled, subscription.expired }`. (`payment.*` events are for the *customer revenue* pipeline in `apps/ingestion` — not handled here.)

### 6.3 `webhook-processor.ts` — `processWebhookEvent(event, webhookId)`

```
const data = event.data as DodoSubscriptionPayload   // narrowed by RELEVANT_EVENTS
const eventTs = new Date(event.timestamp)

await prisma.$transaction(async (tx) => {
  // ── resolve our Subscription row ──
  let sub =
    data.metadata?.internalSubscriptionId
      ? await tx.subscription.findUnique({ where: { id: data.metadata.internalSubscriptionId } })
      : await tx.subscription.findUnique({ where: { dodoSubscriptionId: data.subscription_id } });

  if (!sub && event.type !== "subscription.active") {
    await markDone(tx, webhookId); return;              // pre-active race — wait for active
  }
  if (!sub && event.type === "subscription.active") {
    // fallback: metadata missing AND no row — create from payload (defensive)
    sub = await createSubscriptionFromPayload(tx, data);
  }

  // ── out-of-order guard ──
  if (sub.lastEventAt && eventTs < sub.lastEventAt) { await markDone(tx, webhookId); return; }

  // ── resolve plan from product_id (authoritative) ──
  const { planFamily, planTier, tierEvents, interval } = resolvePlan(data.product_id) ?? fromSubRow(sub);

  // ── compute patch ──
  const patch = buildPatch(event.type, data, { planFamily, planTier, tierEvents, interval });
  //   subscription.active     → status active|trialing, bind dodoSubscriptionId, periods, dodoCustomerId→User
  //   subscription.updated     → status, periods, cancelAtPeriodEnd
  //   subscription.renewed     → periods; flag usageResetNeeded = true
  //   subscription.plan_changed→ planFamily/planTier/tierEvents/interval/dodoProductId; apply pendingPlanChange if due
  //   subscription.on_hold     → status past_due, paymentFailedAt = now
  //   subscription.cancelled   → status canceling (period not over) | canceled (over)
  //   subscription.expired     → status canceled; workspaces will be detached

  const updated = await tx.subscription.update({
    where: { id: sub.id },
    data: { ...patch, lastEventAt: eventTs, lastWebhookId: webhookId },
  });

  // ── first-activation extras ──
  if (event.type === "subscription.active") {
    await tx.user.update({ where: { id: updated.ownerUserId }, data: { dodoCustomerId: data.customer.customer_id } });
    //   ^ safe: dodoCustomerId is @unique on User, but it's the user's OWN customer — see §8.3 note
    if (updated.pendingPlanChange?.consolidateStandardSubIds)
      await consolidateStandardSubs(tx, { growthSubscriptionId: updated.id, standardSubIds: ... });
    if (data.metadata?.targetWorkspaceId)
      await tx.workspace.update({ where: { id: data.metadata.targetWorkspaceId, subscriptionId: null }, data: { subscriptionId: updated.id } });
  }

  // ── terminal: detach workspaces ──
  if (updated.status === "canceled" || event.type === "subscription.expired") {
    await tx.workspace.updateMany({ where: { subscriptionId: updated.id }, data: INACTIVE_BASELINE });
    await tx.subscription.update({ where: { id: updated.id }, data: { workspaceId disconnect via updateMany above; workspaceCount: 0 } });
    // note: set Workspace.subscriptionId = null in the updateMany
  }

  // ── recompute seat count (idempotent, never increment here) ──
  const wc = await tx.workspace.count({ where: { subscriptionId: updated.id } });
  await tx.subscription.update({ where: { id: updated.id }, data: { workspaceCount: wc } });

  // ── fan out ──
  await fanOutSubscription(updated.id, tx);
  // no legacy-column dual-write — see "Deploy 2 — revised for clean slate" above

  await markDone(tx, webhookId);
})

// ── side effects AFTER commit (own flags) ──
if (event.type === "subscription.active" && !sub.welcomeEmailSentAt) {
  await sendWelcomeEmail(...);
  await prisma.subscription.update({ where: { id: sub.id }, data: { welcomeEmailSentAt: new Date() } });
  await onboardingStepCache.mset({ userIds, step: "completed" });   // preserved from subscription-active.ts
}
if (patch.usageResetNeeded) await resetUsageForSubscription(sub.id);   // §7
```

**Idempotency guarantees** (Scenario 10):
- All `Subscription` writes are absolute values.
- `fanOutSubscription` = one `workspace.updateMany` to absolute values.
- `workspaceCount` recomputed via `count()`, never `increment`, in the webhook path.
- `dodoCustomerId → User` write is the same value on every redelivery.
- Welcome email / onboarding gated on `welcomeEmailSentAt`.
- Out-of-order protected by `lastEventAt`.
- Whole thing in one `$transaction` — partial failure rolls back including `markDone`, so a retry re-runs cleanly.

### 6.4 `fan-out.ts`

```ts
export async function fanOutSubscription(subscriptionId: string, tx: PrismaTx) {
  const s = await tx.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
  await tx.workspace.updateMany({
    where: { subscriptionId },
    data: {
      subscriptionStatus: s.status,
      planFamily:         s.planFamily,
      planTier:           s.planTier,
      tierEvents:         s.tierEvents,
      usageLimit:         s.tierEvents,          // D1: per-site limit
      currentPeriodEnd:   s.currentPeriodEnd,
      freeTrialEndDate:   s.trialEndsAt,
      paymentFailedAt:    s.paymentFailedAt,
    },
  });
}
```

**No `fanOutLegacyColumns` function exists or is planned.** The original draft had one, kept only to dual-write the legacy `Workspace.dodo*`/`plan` columns for revertibility against production data. That's moot on a clean reset (see "Deploy 2 — revised for clean slate" above) — Deploy 2 shipped without it.

**Historical note (already shipped in Deploy 1).** The original draft dropped `Workspace.dodoSubscriptionId` / `dodoCustomerId`'s `@unique` constraints in Migration 1 specifically so that legacy dual-write to 30 Growth workspaces wouldn't violate uniqueness (Deploy status table confirms Migration 1 "drop the two `Workspace.dodo*` uniques" already happened). That original rationale (dual-write) no longer applies since dual-write was abandoned — but the DDL already shipped and is harmless to leave as-is; there is no reason to re-add the uniques.

```sql
-- shipped as part of Migration 1 (Deploy 1)
DROP INDEX "Workspace_dodoCustomerId_key";
DROP INDEX "Workspace_dodoSubscriptionId_key";
CREATE INDEX "Workspace_dodoCustomerId_idx" ON "Workspace"("dodoCustomerId");
-- dodoSubscriptionId_idx already exists
```
The old webhook code did `findFirst`/`findUnique` by these — `findUnique` on a now-non-unique column wouldn't compile. `subscription-updated.ts` / `subscription-cancelled.ts` used `findFirst` already; only `subscription-active.ts`'s `findUnique({ where: { dodoCustomerId } })` broke, which is why Deploy 1 also patched that one `findUnique` → `findFirst` as a one-line stopgap before Deploy 2 deleted the file outright (see §14).

### 6.5 Failure / retry handling

- **Transient DB error** inside the tx → 500 → Dodo retries (5s, 5m, 30m, 2h, 5h, 10h, 10h).
- **8 retries exhausted** → Dodo marks failed; dashboard "manual retry" available. The `DodoWebhookEvent` row is `failed` → the §10 reconciliation cron re-derives state from `dodo.subscriptions.retrieve()` regardless.
- **Malformed payload / unknown product_id** → log, `markDone` (don't 500-loop forever), rely on reconciliation.
- **`consolidateStandardSubs` Dodo cancel fails** → transaction already committed the workspace re-point (safe direction); enqueue `billing_reconcile_queue`; alert.

---

## 7. Usage reset & event-limit enforcement

### 7.1 Monthly reset (does not exist today — new)

**Primary trigger:** `subscription.renewed` webhook → `patch.usageResetNeeded = true` → after tx commit:
```ts
async function resetUsageForSubscription(subId: string) {
  await prisma.workspace.updateMany({
    where: { subscriptionId: subId },
    data: { usage: 0, usageLastChecked: new Date() },
  });
}
```

**Backstop cron:** `/api/cron/billing/usage-reset` (daily, `CRON_SECRET` auth):
```
for each Subscription where status in (active, trialing)
    and currentPeriodStart > lastUsageResetAt (add this column, or compare against a derived marker):
  reset usage for its workspaces
  set Subscription.lastUsageResetAt = currentPeriodStart
```
Add `Subscription.lastUsageResetAt DateTime?` in Migration 1 (cheap, additive).

**Anchor = subscription billing period** (D8), not calendar month.

### 7.2 Enforcement (`apps/ingestion/src/controllers/track.ts`) — ✅ done (final production pass)

This was the **one genuine race condition found in the final audit**: the code read `workspace.usage`/`usageLimit` in the initial row fetch, did a cheap early reject (`if (usageLimit > 0 && usage >= usageLimit) return 403`), then — much later, after customer upsert + `recordEvent` (a Tinybird write) — did a **plain, unconditional** `workspace.update({ data: { usage: { increment: 1 } } })`. Concurrent requests could all pass the early check before any of them incremented, over-running `usageLimit` with no bound. Fixed to an atomic guarded `updateMany`:
```ts
const guard = await prisma.workspace.updateMany({
  where: {
    id: workspace.id,
    ...(usageLimit > 0 ? { usage: { lt: usageLimit } } : {}),
  },
  data: { usage: { increment: 1 } },
});
if (guard.count === 0 && usageLimit > 0) {
  return res.status(403).json({ success: false, error: "Usage limit exceeded", code: "exceeded_limit" });
}
```
The early cheap check stays as a fast-path reject; the atomic update is the real gate — the DB row lock serializes concurrent requests, so `usage` can never exceed `usageLimit`. **`usageLimit = 0` means uncapped**, not blocked (the `usage: {lt}` condition is omitted entirely when `usageLimit` is 0) — this only matters for a workspace whose `subscriptionStatus` allows access but whose fan-out never set a real tier limit, which shouldn't happen in normal operation since `fanOutSubscription` always writes `usageLimit = tierEvents` (always > 0 for a real tier) together with the status; an uncovered workspace's `usageLimit: 0` is unreachable here because §8.8's entitlement check already blocks `inactive` earlier. Verified both by a live-DB race test (10 concurrent requests against a workspace with exactly 1 slot left → exactly 1 succeeds, usage stops at the limit) and the whole D6 status matrix, in `apps/e2e/tests/billing-enforcement.spec.ts` (17/17 passing).

`t10m_plus`: `usageLimit` is **not** `Number.MAX_SAFE_INTEGER` — `tierEvents`/`usageLimit` are Postgres `Int` (32-bit) columns, and writing `Number.MAX_SAFE_INTEGER` (9,007,199,254,740,991) into one throws `Value out of range for the type: ... integer` (verified against the dev DB) — which would have crashed *every* checkout, webhook, and fan-out for this tier, on both Standard and Growth, both intervals. `pricing.tsx`'s `UNCAPPED` sentinel is now `2_000_000_000` (safely under Postgres Int32's ~2.147B ceiling, with headroom for the 0.95× usage-warning math below, and still far larger than `Workspace.usage` itself — also an Int32 column — could ever reach). The 95%-warning math (`Math.ceil(usageLimit * 0.95)`) does not need a special case with this sentinel; it just computes a very large (but valid) threshold that in practice is never crossed.

---

## 8. API endpoint changes

### 8.1 New — `app/api/subscriptions/route.ts`

`POST` (auth: session; **not** `withWorkspace` — subscription is user-scoped):
```
body (lib/zod/schemas/subscriptions.ts):
  { intent: "standard" | "growth",
    tier: enum(t10k..t10m_plus),
    interval: "monthly" | "yearly",
    targetWorkspaceId?: string,
    consolidateStandardSubIds?: string[],
    acknowledgement?: { ... }  // for growth switch that cancels standard subs
  }
→ subscriptionService.createSubscriptionCheckout(...)
→ 200 { checkoutUrl }
```
`GET` → list caller's `Subscription`s with `{ id, planFamily, planTier, status, workspaceCount, maxWorkspaces, currentPeriodEnd, cancelAtPeriodEnd, workspaces: [{id,slug,name}] }`.

### 8.2 New — subscription sub-routes

| Route | Method | Body | Calls |
|---|---|---|---|
| `app/api/subscriptions/[id]/change-plan/route.ts` | POST | `{ targetFamily, targetTier, targetInterval, keepWorkspaceId?, acknowledgement? }` | `subscriptionService.changePlan` |
| `app/api/subscriptions/[id]/cancel/route.ts` | POST | `{ mode: "at_period_end" \| "immediately", acknowledgeWorkspaceIds?: string[] }` | `subscriptionService.cancelSubscription` |
| `app/api/subscriptions/[id]/resume/route.ts` | POST | — | `subscriptionService.resumeSubscription` |

Authz: every handler loads the `Subscription` and checks `ownerUserId === session.user.id` → else 403. (D9: only the owner; workspace `billing` role does not grant this.)

### 8.3 New — `app/api/workspaces/[idOrSlug]/billing/attach` & `detach`

`withWorkspace`, `requiredPermission: "billing:write"`. `attach` body `{ subscriptionId }` → `subscriptionService.attachWorkspace` (also asserts `session.user.id === subscription.ownerUserId`). `detach` → `subscriptionService.detachWorkspace`.

### 8.4 New — `app/api/billing/context/route.ts`

`GET`, session auth. Returns everything the "Add Website" / billing UI needs in one call:
```jsonc
{
  "dodoCustomerId": "cus_… | null",
  "trialAvailable": true,                       // user.freeTrialUsedAt == null
  "subscriptions": [
    { "id", "planFamily", "planTier", "interval", "status",
      "workspaceCount", "maxWorkspaces", "currentPeriodEnd", "cancelAtPeriodEnd" }
  ],
  "growthSubWithFreeSeat": { "id", "workspaceCount", "maxWorkspaces" } | null,
  "standardSubs": [ { "id", "planTier", "workspaceId" } ]
}
```

### 8.5 Changed — existing billing routes

| File | Change |
|---|---|
| `app/api/workspaces/[idOrSlug]/billing/upgrade/route.ts` | **Deprecate.** Keep as a thin shim that forwards to `/api/subscriptions` + `/api/subscriptions/[id]/change-plan` for one release (old UI may still call it under the flag), then delete. |
| `.../billing/manage/route.ts` | `dodo.customers.customerPortal.create(...)` — was `workspace.dodoCustomerId`. **Revised in the final production-readiness pass:** resolves through `lib/billing/billing-identity.ts`'s `requireBillingOwnerDodoCustomerId(workspace.id, session.user.id)` rather than blindly using the *viewing session user's own* `dodoCustomerId` — that original approach worked for the subscription owner but silently showed a non-owner `billing:write` team member their own (unrelated) Dodo data instead of the workspace's real billing. Per D9, a non-owner is now refused (403) rather than shown the wrong (or the owner's, cross-customer) data. |
| `.../billing/invoices/route.ts` | Query Dodo by the subscription owner's `dodoCustomerId`, resolved the same way as `manage/route.ts` above (D9). |
| `.../billing/payment-methods/route.ts` | Query Dodo by the subscription owner's `dodoCustomerId`, resolved the same way (D9) — GET, POST, and DELETE all route through it. |
| `.../billing/route.ts` (GET billing cycle) | Read `workspace.subscription.billingInterval` / `.dodoProductId` directly — drop the `dodo.subscriptions.retrieve()` round-trip; the data is on our row now. |
| `.../billing/start-free-trial/route.ts` | Create a `Subscription` (`status: "trialing"`, `dodoSubscriptionId: null`, `trialEndsAt = now+14d`, family/tier from body or default `standard`/`t10k`, `maxWorkspaces` per family, `workspaceCount: 1`), attach `workspace.subscriptionId`, fan out. Still gated by `user.freeTrialUsedAt` (set it in the same tx). Keep `Serializable` isolation. |

### 8.6 Changed — `app/api/workspaces/route.ts`

`POST`: creates the workspace exactly as before (`subscriptionId: null`, `subscriptionStatus: "inactive"`, `planTier: null`), then — **Deploy 8** — calls `grantAutoTrialForNewWorkspace()` (`lib/billing/auto-trial.ts`) in a `try/catch` that only logs on failure. If the grant succeeds, the workspace row is re-fetched so the JSON response already reflects the fanned-out trial fields (`subscriptionStatus: "trialing"`, `freeTrialEndDate`, etc.) without a second client round-trip. A failed or ineligible grant never fails the request — the workspace is still created and returned uncovered, same as today, for the caller to cover later via `/[slug]/billing`.

(Historical note: an earlier revision of this plan said "remove nothing here — the auto-trial is in the *form*, not this route" and had the client drive an onboarding billing-choice step next. Deploy 8 reverses that — see "Deploy 8" narrative above.)

### 8.7 Changed — `app/api/workspaces/[idOrSlug]/route.ts`

- `GET` → include `subscription` (nested summary) in the response; `WorkspaceSchema` updated (§9.4).
- `DELETE` → `deleteWorkspace` now frees the seat (§14, `lib/api/workspaces/delete-workspace.ts`).

### 8.8 Changed — `lib/api/workspaces/check-subscription-status.ts` (D6) — ✅ done (Deploy 5)

Implemented as a **shared** function rather than duplicated per-app logic, so apps/web and apps/ingestion can't drift out of sync the way the original draft's two separate call sites did:

```ts
// packages/analytics/src/billing-access.ts — imported by BOTH apps/web (entitlement.ts,
// which hasWorkspaceAccess delegates to) and apps/ingestion (track.ts, track-ai-bot.ts).
export const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function isWorkspaceEntitled(workspace: WorkspaceAccessState): boolean {
  const status = workspace.subscriptionStatus ?? "inactive";
  if (status === "active" || status === "canceling") return true;   // canceling: access continues until period end
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
```

`apps/web/lib/api/workspaces/check-subscription-status.ts`'s `hasWorkspaceAccess` reads the same `Workspace` fields and delegates to `isEntitled` (which itself delegates to `isWorkspaceEntitled`). `apps/ingestion/src/controllers/track.ts` and `track-ai-bot.ts` both call `isWorkspaceEntitled` directly (with `paymentFailedAt`/`freeTrialEndDate` added to their `workspace` selects) instead of their original `subscriptionStatus === "inactive"` check, which had **no grace cap at all** — a `past_due` workspace could ingest indefinitely. Verified with a full status-matrix e2e suite (`apps/e2e/tests/billing-enforcement.spec.ts`) hitting `/api/track` directly: active/canceling/trialing-valid pass, trialing-expired/inactive/past_due-no-date/past_due-past-grace are blocked, past_due-within-grace (fresh and at 6 days) passes, past_due-at-8-days is blocked.

### 8.9 Changed — `lib/auth/workspace.ts` — ✅ done (Deploy 5)

Removed the per-request trial-expiry flip. Trial expiry now happens only via the webhook / reconciliation cron, keyed on `Subscription`, so siblings flip together. This also fixed a genuine Subscription↔Workspace consistency bug the flip had: it only ever wrote the *one* `Workspace` row on the current request, never the owning `Subscription` and never fanned out to sibling workspaces on a shared Growth trial, so a multi-workspace Growth trial could show one workspace "inactive" and its siblings still "trialing" depending on which one happened to receive a request first. (It's also unnecessary for correctness: `isEntitled`/`isWorkspaceEntitled` already deny access once `freeTrialEndDate` is in the past regardless of the cached status string — removing the flip is a pure simplification + a write-per-request perf win, not a behavior loosening.)

### 8.10 Validation schemas — `lib/zod/schemas/subscriptions.ts` (new)

`createSubscriptionSchema`, `changePlanSchema`, `cancelSubscriptionSchema`. `tier` = `z.enum(["t10k",...,"t10m_plus"])`. `interval = z.enum(["monthly","yearly"])`. Reuse `booleanQuerySchema` from `lib/zod/schemas/misc`.

---

## 9. Frontend / pricing / checkout changes

Behind flag `NEXT_PUBLIC_BILLING_V2` (Deploy 3). When off, the old billing page + old `upgrade` route (kept as a shim, §8.5) are used against the new `Subscription`-backed denormalized `Workspace` fields.

### 9.1 `pricing.tsx` — §3.4.

### 9.2 Components

| File | Change |
|---|---|
| `ui/workspaces/create-workspace-form.tsx` | **Remove** the `startFreeTrial(workspace.id)` call and its toast. After create, call `onSuccess` which now routes to `/{slug}/billing?new=1` (billing choice step) instead of `/{slug}`. |
| `ui/modals/create-workspace-modal.tsx` | `onSuccess` → push to the billing choice step, not the dashboard. |
| `app/app.convrs.dev/(dashboard)/[slug]/billing/page.tsx` | **Rebuild.** Fetch `/api/billing/context` + `useWorkspace`. States: (a) uncovered new workspace → 3 cards (Add to Growth if free seat / Buy Standard / Switch to Growth or Start trial) per Scenario 6 decision tree; (b) covered → current plan panel (family, tier, interval, sites `N/max`, renewal date, trial countdown), tier up/down, Standard↔Growth, Manage billing (portal), Cancel. |
| `ui/upgrade-plan.tsx` (`UpgradePlanButton`) | Route to `/api/subscriptions` (new checkout) or `/api/subscriptions/[id]/change-plan` (existing). Keep family-aware logic. New tier names. |
| `ui/upgrade-plan-pricing-card.tsx` | `buildEventTiers` from new `PRICING_FAMILIES`; slider label `10M+` case in `formatEventsForDisplay`; new prices. |
| `app/app.convrs.dev/(onboarding)/onboarding/(steps)/billing/form.tsx` | **Build** (currently returns empty `<div>`). First-subscription choice: Standard vs Growth, tier slider, interval, "Start 14-day free trial" (if `trialAvailable`). Calls `/api/subscriptions`. |
| `ui/layout/sidebar/free-trial-banner.tsx` | Copy: for a Growth trial say "covers all your sites". Logic unchanged (reads denormalized `subscriptionStatus`/`freeTrialEndDate`). |
| `app/app.convrs.dev/(dashboard)/[slug]/settings/integrations/page.tsx` | `planFamily !== "growth"` gate at line ~328 works unchanged (denormalized). Update the upsell copy + link to `/{slug}/billing`. |
| **New** `app/app.convrs.dev/(dashboard)/account/subscriptions/page.tsx` (or `settings/subscriptions`) | Account-level: list `/api/subscriptions`, each with linked sites, seat usage, per-sub upgrade/downgrade/cancel/resume, "Manage billing" → portal. This is the home for cross-workspace billing (no `Organization` page). |
| `ui/layout/sidebar/*` (workspace switcher) | Badge each workspace: covered / trial / **inactive**; for Growth show `N/30`. |

### 9.3 SWR hooks (`apps/web/lib/swr/`)

| Hook | Change |
|---|---|
| `use-workspace.ts` | Expose `subscription` from the workspace payload. |
| `use-workspaces.ts` | (optional) include coverage flag per workspace. |
| **New** `use-billing-context.ts` | `GET /api/billing/context`. |
| **New** `use-subscriptions.ts` | `GET /api/subscriptions` + `mutate` helpers. |

### 9.4 `lib/zod/schemas/workspaces.ts`

- **Delete** phantom fields: `stripeId`, `stripeCustomerId`, `stripeSubscriptionId`, `billingCycleStart`, `planTier` (the `z.number()` one — replace with the string version or drop).
- **Add**: `subscriptionId: z.string().nullable().optional()`, `planTier: z.string().nullable().optional()`, `subscription: SubscriptionSummarySchema.nullable().optional()`.
- Keep `subscriptionStatus`, `planFamily`, `freeTrialEndDate`, `usage`, `usageLimit`, `tierEvents`, `paymentFailedAt` (still denormalized on Workspace).
- `apps/web/lib/types.ts` `WorkspaceProps` — add `subscription`, `subscriptionId`, `planTier`; keep `dodoCustomerId`/`dodoSubscriptionId` optional until Deploy 7.

### 9.5 `e2e` seed (`apps/e2e/fixtures/seed.ts`, `seed-data.ts`) — partially done

- `createWorkspace` still sets `subscriptionStatus: "active"` with **no `Subscription` row** — every existing spec (auth, rbac, bot-detection, etc.) only needs a workspace that passes the entitlement gate, not a real subscription, so this was left as-is; it is not "covered-with-no-sub" drift because nothing reads `Workspace.subscriptionId` in those specs.
- **Added** `createBillingTestWorkspace(namePrefix, overrides)` — sets the denormalized billing-cache fields directly (`subscriptionStatus`, `usage`, `usageLimit`, `freeTrialEndDate`, `paymentFailedAt`), which is exactly what `fanOutSubscription` would have written; used by the new `apps/e2e/tests/billing-enforcement.spec.ts` for the D6 status matrix and the usage-limit race test. This does not exercise checkout/webhook/Dodo at all — see §16 below for what's still untested.
- **Not built:** `createStandardSubscription`/`createGrowthSubscription` seed helpers that create a real `Subscription` row + link a workspace (originally planned here) — no spec needed them yet since nothing in the added coverage exercises `subscription-service.ts`'s DB writes end-to-end (those are covered by `apps/web`'s own vitest suite instead, against extracted pure functions). Add them if a future e2e spec needs to drive `attachWorkspace`/`changePlan`/etc. through the real HTTP API rather than unit-level.

---

## 10. Reconciliation cron

`app/api/cron/billing/reconcile/route.ts` — hourly, `CRON_SECRET` auth (`lib/cron/verify-vercel-signature.ts`). Add to `vercel.json` (and **fix the pre-existing `social/attribution-reconcilation` path mismatch** in the same PR).

**Per `Subscription` with `dodoSubscriptionId != null` and `status ∉ {canceled, expired}`:**

| Check | Repair |
|---|---|
| Dodo `retrieve()` status ≠ our `status` | apply Dodo's status via the same `buildPatch` + `fanOutSubscription` path (idempotent) |
| Dodo `product_id` ≠ our `dodoProductId` | re-resolve plan, update `Subscription`, fan out |
| Dodo `next_billing_date` ≠ our `currentPeriodEnd` | update periods; if it advanced → run `resetUsageForSubscription` |
| `workspaceCount ≠ count(Workspace where subscriptionId)` | recompute + fan out |
| any attached `Workspace.subscriptionStatus/planFamily/planTier/usageLimit ≠ derived from sub` | re-run `fanOutSubscription` |
| `pendingPlanChange.effectiveAt <= now` and not yet applied | apply the scheduled change (tier down / growth→standard §7 detach), clear `pendingPlanChange` |
| `status ∈ {canceling}` and `currentPeriodEnd < now` | transition to `canceled`, detach workspaces, `workspaceCount = 0` |
| `status = "trialing"`, `trialEndsAt < now`, `dodoSubscriptionId = null` (cardless trial lapsed) | `status = "inactive"`, fan out (all sibling workspaces flip together) |
| Dodo sub exists, **no** matching `Subscription` row (missed `active` webhook) | create the row from `retrieve()` + bind any workspace whose legacy `dodoSubscriptionId` matches |
| `billing_reconcile_queue` rows (failed consolidation cancels, §5.6) | retry `dodo.subscriptions.update(cancel_at_next_billing_date)` |

Also: `DodoWebhookEvent` rows `status = "failed"` older than 1h → attempt reprocess from `retrieve()`; rows older than 90 days → delete.

**Idempotent by construction** — every repair is "set to derived value" + `fanOutSubscription`.

Emit a metric/log line per run: `{ scanned, drifted, repaired, unrepairable }`. Alert if `unrepairable > 0`.

---

## 11. Trial behaviour (implementation)

Per D7: **one 14-day cardless trial per User, lifetime, first subscription only.**

**Deploy 8:** there is no onboarding billing step anymore. The first row below is now split in two — an *automatic* grant on workspace creation (the common case) and the pre-existing *manual* grant (for a workspace that didn't qualify automatically, e.g. not the user's first owned workspace).

| Path | Behaviour |
|---|---|
| **(Deploy 8, automatic)** User's first **owned** workspace, and they're eligible | `POST /api/workspaces` → `grantAutoTrialForNewWorkspace()` (`lib/billing/auto-trial.ts`) runs immediately after workspace creation, no user action, no billing-page visit. Eligible only if `freeTrialUsedAt == null` **and** zero prior `WorkspaceUsers` rows with `role: "owner"` for that user (member/invitee elsewhere doesn't count) **and** zero existing `Subscription` rows for that user. Same create-`Subscription`-status-`"trialing"` / set-`freeTrialUsedAt`-in-the-same-tx shape as below, `Serializable`. |
| Manual grant on an already-created, uncovered workspace | `POST /api/workspaces/[idOrSlug]/billing/start-free-trial` (visited from `/[slug]/billing` — e.g. a second/later workspace, or the automatic grant didn't apply) — unchanged by Deploy 8. Create `Subscription` `status: "trialing"`, `dodoSubscriptionId: null`, `trialEndsAt = now+14d`, `user.freeTrialUsedAt = now` (same tx, `Serializable`). Attach workspace, fan out. |
| Trial → paid conversion | `POST /api/subscriptions` with the existing `internalSubscriptionId` of the trial sub in `metadata`; `subscription_data.trial_period_days = getRemainingTrialDays(trialEndsAt)` (keep `lib/billing/trial-utils.ts::getRemainingTrialDays`). Webhook `subscription.active` back-fills `dodoSubscriptionId`, status stays access-granting for both `"active"` and `"trialing"`. |
| Add website while on a Growth trial | `attach` → workspace inherits `trialEndsAt` via fan-out. No new trial, no charge. |
| Add website #2 while on a **Standard** trial | Standard trial covers 1 site. UI offers: (a) new Standard sub for site 2 (paid checkout, no trial — `freeTrialUsedAt` set), or (b) `changePlan` the trial sub Standard→Growth (stays trialing, `maxWorkspaces → 30`), then `attach` site 2. |
| Trial expiry (cardless, no conversion) | Reconciliation cron: `status → "inactive"`, fan out → all sibling workspaces `inactive` together. |
| `withWorkspace` per-request flip | **Removed** (§8.9). |
| `freeTrialEndDate` on Workspace | Still written (fan-out mirror of `trialEndsAt`) so `free-trial-banner` / `hasWorkspaceAccess` / `check-free-trial-days-left` are unchanged. |

---

## 12. Backward compatibility & rollout

**Note:** Deploy 1.5 (backfill) is removed from this table — it was abandoned and never built (§4). There is no legacy production data for Deploy 2 onward to protect, so "old code still works" below is about additive/flagged rollout mechanics, not data-migration compatibility.

| Deploy | Old code still works because… | Revert = |
|---|---|---|
| 1 (schema) | purely additive; old webhook writes legacy columns as before; `subscription-active.ts` `findUnique`→`findFirst` one-liner keeps it compiling after the `@unique` drop | `prisma migrate resolve --rolled-back` + redeploy previous build (new tables sit unused) |
| 2 (new write path) | no legacy dual-write (clean reset, no data to protect); old billing UI still calls old `upgrade` route (kept as shim); `entitlement`/`social-eligibility` read the denormalized `Workspace` fields that the new webhook populates | redeploy Deploy-1 build; new endpoints 404 harmlessly (no UI calls them yet) |
| 3 (frontend) | flag `NEXT_PUBLIC_BILLING_V2`; off → old UI | flip flag off |
| 4 (crons) | additive; crons are idempotent repairs | remove cron entries from `vercel.json` |
| 5 (enforcement) | `POST /api/workspaces` behaviour change + past_due grace + seat caps | redeploy Deploy-4 build; caps stop enforcing; trial auto-start returns¹ |
| 6 (observation window) | legacy columns already unwritten since Deploy 2; this is a confidence window before Deploy 7 drops them, not a dual-write cutover | no code change to revert — just don't proceed to Deploy 7 |
| 7 (drop columns) | every reader migrated to `planTier` / `workspace.subscription` | **irreversible without a restore** — see §13 |
| 8 (onboarding billing step removed; auto-trial restored) | independent of the schema/enforcement deploys above — touches only onboarding routing + `POST /api/workspaces` + new `lib/billing/auto-trial.ts`; no DB/Dodo/schema change | redeploy the pre-Deploy-8 build; onboarding billing step and its `BILLING_V2` branching return, and the automatic first-workspace grant is removed again (the manual `start-free-trial` route is untouched either way) |

¹ Historical: this described reverting Deploy 5 back to Deploy 4, whose `create-workspace-form.tsx` had its own client-side auto-trial call. Deploy 8 (row above) separately restored an automatic grant going forward regardless of Deploy 5/6/7's state, so as of Deploy 8 this note is superseded — see the "Deploy 8" narrative above for the current mechanism.

**Flags:**
- `NEXT_PUBLIC_BILLING_V2` — UI cutover (Deploy 3).
- No flag on the webhook rewrite itself.
- There is **no** `BILLING_LEGACY_DUAL_WRITE` flag — it was part of the abandoned dual-write design and was never built.

---

## 13. Rollback strategy if migration or Dodo reconciliation fails

### 13.1 During Deploy 1 (schema)
`CREATE TABLE` fails or is slow → Postgres DDL for these small additive changes is near-instant; if it hangs, `pg_cancel_backend`. No data at risk. `prisma migrate resolve --rolled-back <name>`, drop the partial tables manually if needed, redeploy previous build.

### 13.2 Deploy 1.5 (backfill) — ABANDONED, no rollback needed
There is no backfill step to roll back. Deploy 1.5 was abandoned in favor of a clean database reset (see "Clean-database reset" above); §13's original `13.2` covering `--dry-run`/`--commit`/`--resume` and a `scripts/rollback-subscriptions.ts` script never applied to anything that shipped.

### 13.3 Post-Deploy 2, discover the new path is wrong
- Redeploy the Deploy-1 build. Since there is no legacy dual-write to unwind, this is a plain code revert: the old webhook path resumes, and the new `Subscription` rows become stale but **inert** (nothing reads them, and no legacy column was ever populated from them). Fix forward, re-run a targeted reconciliation, redeploy Deploy 2.

### 13.4 Post-Deploy 7 (columns dropped), critical bug found
- This is the only genuinely hard rollback. Mitigations:
  - Take a **logical dump of `Workspace` + `Subscription` + `User`** immediately before Migration 2.
  - Keep Deploy 6 running ≥14 days as an observation window before proceeding.
  - Recovery migration: re-add the columns (nullable), run a reverse-fan-out (`Subscription` → legacy columns), redeploy Deploy-6 build. Budget this as a ~1-day incident, not a click.

### 13.5 Dodo-side reconciliation failure (e.g. `changePlan` succeeded in Dodo but our webhook never confirmed)
- The reconciliation cron (§10) re-derives our state from `dodo.subscriptions.retrieve()` every hour — this is the primary self-heal.
- `billing_reconcile_queue` for actions we initiated that Dodo rejected (failed consolidation cancels) → manual dashboard action + re-queue.
- A "billing drift" dashboard: list `Subscription`s where `lastEventAt` older than `currentPeriodEnd` + 1 day, or `status` disagreeing with Dodo.

---

## 14. Every file/module that changes, and why

### Schema — `packages/db/schema/`
| File | Why |
|---|---|
| `workspace.prisma` | add `Subscription`, `DodoWebhookEvent`, `Subscription.lastUsageResetAt`; `Workspace.subscriptionId` + `planTier`; drop `@unique` on `Workspace.dodoCustomerId`/`dodoSubscriptionId` (Deploy 1); drop those columns + `billingInterval` (Deploy 7) |
| `schema.prisma` | `User.dodoCustomerId` + `subscriptions` relation |
| `invoice.prisma` | `Invoice.workspace onDelete` (D14, pre-existing bug) |
| `migrations/*` | 2 new migration folders |

### Pricing / utils — `packages/utils/`
| File | Why |
|---|---|
| `src/constants/pricing/pricing.tsx` | new 9 tiers, new events, exact D16 prices, 36 new product IDs, `FAMILY_LIMITS`, tier rename, `getPlanFromProductId` returns `tierKey`, `formatEventLimit` `10M+` case, delete `getPlanFromPriceId` cast |
| `src/index.ts` (barrel) | export `FAMILY_LIMITS`, any new helpers |

### Billing lib — `apps/web/lib/billing/`
| File | Why |
|---|---|
| `entitlement.ts` | `workspaceHasSocialAttribution` also requires `subscriptionStatus ∈ {active,trialing}`; still reads denormalized `planFamily` |
| `social-eligibility.ts` | add `subscriptionStatus: { in: ["active","trialing"] }` to the `findMany` where |
| `apply-subscription.ts` | **delete** — superseded by `webhook-processor.ts` + `fan-out.ts` |
| `trial-utils.ts` | keep `getRemainingTrialDays`; add `isTrialAvailable(user)` |
| `fan-out.ts` | **new** — `fanOutSubscription`, `INACTIVE_BASELINE` (no `fanOutLegacyColumns` — no legacy dual-write) |
| `subscription-service.ts` | **new** — create/changePlan/cancel/resume/attach/detach/consolidate |
| `webhook-processor.ts` | **new** — `processWebhookEvent` |
| `plan-resolver.ts` | **new** — `resolvePlan(productId)` wrapper + old-product-id fallback table |
| `dodo-checkout.ts` | **new** — checkout session builder (attach-existing-customer, metadata, trial injection) |
| `billing-identity.ts` | **new** (final production-readiness pass) — `requireBillingOwnerDodoCustomerId` / `decideBillingIdentity`: resolves which Dodo customer `invoices`/`payment-methods`/`manage` may read, enforcing D9 (subscription owner only) |
| `auto-trial.ts` | **new (Deploy 8)** — `isAutoTrialEligible()` + `grantAutoTrialForNewWorkspace()`, called from `POST /api/workspaces` (§8.6); reuses `plan-resolver.ts` + `fan-out.ts`, same `Serializable`-tx shape as `start-free-trial/route.ts` |

### Dodo — `apps/web/lib/dodo/`
| File | Why |
|---|---|
| `types.ts` | add `metadata.internalSubscriptionId`/`targetWorkspaceId`/`intent`; checkout-session response type; `subscription_id` on payload already present |
| `index.ts` | no change |

### Webhook — `apps/web/app/api/dodo/webhook/`
| File | Why |
|---|---|
| `route.ts` | rewrite: dedup, transactional, awaited, no fire-and-forget |
| `subscription-active.ts` / `subscription-updated.ts` / `subscription-cancelled.ts` | **delete** (logic → processor) — but in **Deploy 1** patch `subscription-active.ts` `findUnique({where:{dodoCustomerId}})` → `findFirst` (survives the `@unique` drop) |
| `utils/update-worksapce-plan.ts` | **delete** (already dead) |

### Billing API routes — `apps/web/app/api/workspaces/[idOrSlug]/billing/`
| File | Why |
|---|---|
| `upgrade/route.ts` | deprecate → shim → delete |
| `manage/route.ts` | portal from the subscription owner's `dodoCustomerId` (via `lib/billing/billing-identity.ts`, D9 — see §8.5) |
| `invoices/route.ts` | Dodo query by the subscription owner's `dodoCustomerId` (D9) |
| `payment-methods/route.ts` | Dodo query by the subscription owner's `dodoCustomerId` (D9) |
| `route.ts` | read `workspace.subscription` instead of `dodo.subscriptions.retrieve()` |
| `start-free-trial/route.ts` | create trial `Subscription` row instead of stamping the workspace |

### New API routes — `apps/web/app/api/`
`subscriptions/route.ts` (POST, GET), `subscriptions/[id]/change-plan/route.ts`, `subscriptions/[id]/cancel/route.ts`, `subscriptions/[id]/resume/route.ts`, `workspaces/[idOrSlug]/billing/attach/route.ts`, `workspaces/[idOrSlug]/billing/detach/route.ts`, `billing/context/route.ts`.

### Workspace routes / helpers — `apps/web/`
| File | Why |
|---|---|
| `app/api/workspaces/route.ts` | ensure created workspace is `inactive`/`subscriptionId:null`/`planTier:null`; **(Deploy 8)** then best-effort call `grantAutoTrialForNewWorkspace()`, re-fetching the workspace only if granted |
| `app/api/workspaces/[idOrSlug]/route.ts` | GET returns nested `subscription`; DELETE frees seat |
| `lib/api/workspaces/delete-workspace.ts` | replace `cancelSubscription(workspace.dodoCustomerId)` (which wrongly calls **Stripe**) with `subscriptionService.detachWorkspace` + (Standard, now-empty) Dodo cancel; drop the `Pick<..., "dodoCustomerId">` signature → take `subscriptionId` |
| `lib/api/workspaces/check-subscription-status.ts` | past_due grace (D6) |
| `lib/api/workspaces/check-free-trial-days-left.ts` | unchanged (reads `freeTrialEndDate`) |
| `lib/auth/workspace.ts` | remove per-request trial flip |
| `lib/types.ts` | `WorkspaceProps`: add `subscription`, `subscriptionId`, `planTier`; **(Deploy 8)** `ONBOARDING_STEPS` drops `"billing"` |
| `lib/middlewarre/app.ts` | **(Deploy 8)** stale cached `"workspace"`/`"billing"` onboarding step now coerces to `"script"`, never `"billing"` |

### Zod — `apps/web/lib/zod/schemas/`
| File | Why |
|---|---|
| `workspaces.ts` | drop phantom stripe/`billingCycleStart`/`planTier(number)` fields; add `subscription`, `subscriptionId`, `planTier(string)` |
| `subscriptions.ts` | **new** |

### SWR — `apps/web/lib/swr/`
`use-workspace.ts` (expose `subscription`), **new** `use-billing-context.ts`, **new** `use-subscriptions.ts`, `use-workspaces.ts` (optional coverage flag).

### UI — `apps/web/`
`ui/workspaces/create-workspace-form.tsx` (Deploy 3b: drop auto-trial → **Deploy 8: client-side trial call removed entirely**, now just a courtesy toast reflecting the server-side grant already reflected in the create response), `ui/modals/create-workspace-modal.tsx` (routes to the real `/[slug]/billing?new=1` page for a workspace created from inside the dashboard — unrelated to the onboarding billing step and unchanged by Deploy 8), `app/app.convrs.dev/(dashboard)/[slug]/billing/page.tsx` (rebuild), `ui/upgrade-plan.tsx`, `ui/upgrade-plan-pricing-card.tsx`, ~~`app/app.convrs.dev/(onboarding)/onboarding/(steps)/billing/form.tsx` (build)~~ — **Deploy 8: this file, its `page.tsx`, and `page-deleted.tsx` are deleted; the onboarding billing step no longer exists**, `ui/layout/sidebar/free-trial-banner.tsx` (copy), `app/app.convrs.dev/(dashboard)/[slug]/settings/integrations/page.tsx` (upsell copy), **new** `app/app.convrs.dev/(dashboard)/account/subscriptions/page.tsx`, `ui/layout/sidebar/*` (coverage badges).

### Ingestion — `apps/ingestion/src/controllers/`
| File | Why |
|---|---|
| `track.ts` | atomic usage-increment gate; past_due grace (D6); add `paymentFailedAt` to select |
| `track-ai-bot.ts` | verify + align `subscriptionStatus` handling (it references billing fields per grep) |

### Cron — `apps/web/app/api/cron/`
**new** `billing/reconcile/route.ts`, **new** `billing/usage-reset/route.ts`; `social/*` 5 routes — **no change** if `social-eligibility.ts` is updated centrally (verify each still imports from it).

### Config
`vercel.json` — add `billing/reconcile` + `billing/usage-reset` crons; fix `social/attribution-reconciliation` path mismatch (pre-existing).

### Tests — `apps/web` (vitest) + `apps/e2e` (Playwright)
`apps/e2e/fixtures/seed.ts` + `seed-data.ts` (subscription helpers), plus all the new spec files in §13-tests below. **(Deploy 8, new)** `lib/billing/auto-trial.test.ts` — unit tests for `isAutoTrialEligible()` covering every edge case in §11 (new user + first/second owned workspace, trial-already-used, existing subscription, member/invitee-doesn't-count).

### Scripts — `scripts/` (new dir or existing)
`dodo-product-audit.ts`. (`backfill-subscriptions.ts`, `backfill-verify.ts`, and `rollback-subscriptions.ts` were part of the abandoned Deploy 1.5 backfill — §4 — and are not built.)

### Dead code deleted at Deploy 7
`lib/billing/apply-subscription.ts`, `app/api/dodo/webhook/subscription-*.ts` (3), `app/api/dodo/webhook/utils/update-worksapce-plan.ts`, `app/api/workspaces/[idOrSlug]/billing/upgrade/route.ts`, `lib/stripe/cancel-subscription.ts` misuse in `delete-workspace.ts`. Consider removing `lib/stripe/*` entirely if nothing else uses it (grep first).

---

## 15. Assumptions & unresolved product decisions

**No backfill / no legacy migration.** Deploy 1.5 was abandoned (§4); D15 (split-Dodo-customer backfill handling) and A1 (old `WorkspacePlan` → `planTier` backfill map) are deleted below rather than restated, since neither applies once there is no legacy data to migrate. Do not reintroduce either under another name.

### Blocking — must be answered before Deploy 0
None remain. `D10` and `D13` were the only blocking items and both are now resolved — see below; the products table (§3.2) already reflects both.

### Decisions taken in the architecture doc, restated as assumptions this plan builds on
| ID | Assumption |
|---|---|
| D1 | Event limit is **per-website** = tier events. Each attached workspace/website gets the full `tierEvents` limit of the subscription tier — the limit is **not** shared across workspaces on one Growth subscription (`Workspace.usageLimit = tierEvents`, fanned out per attached workspace). |
| D2 | **Multi-Standard→Growth consolidation** (distinct from a normal single Standard→Growth upgrade): when a user with multiple Standard subscriptions buys Growth, eligible workspaces are re-pointed to the new Growth subscription immediately; the now-redundant Standard subscriptions are **not** cancelled immediately — they're scheduled for cancellation (`cancel_at_period_end = true`) at the end of their current billing periods. |
| D3 | Tier stored as the authoritative **`planTier: String`** keyed to `pricing.tsx` (source of truth for tier metadata — event limits/pricing/product mapping). The old `WorkspacePlan` enum is retained as a column (dropped in Deploy 7) but is **not authoritative** and is **not** backfilled or migrated from — no data survives the reset. |
| D4 | Tier **downgrade** and Growth→Standard use `do_not_bill` so there's no immediate proration/charge; the change is scheduled for the next renewal and the current plan stays active until then. For Growth→Standard specifically (Standard supports only 1 workspace), the user must select/acknowledge which workspace remains attached — workspaces are never silently removed. |
| D5 | A Standard subscription whose only workspace is deleted becomes empty and is **auto-scheduled for cancellation** at period end (not cancelled immediately) — the customer retains access through the already-paid period. |
| D6 | **Confirmed and implemented.** `past_due` grace window = **7 days** (from `paymentFailedAt`), applied via one shared function (`isWorkspaceEntitled`, `packages/analytics/src/billing-access.ts`) in `hasWorkspaceAccess` (apps/web), `track.ts`, and `track-ai-bot.ts` (apps/ingestion) — not three independent implementations that could drift. Verified against the full status matrix (before/at/after the 7-day boundary, missing `paymentFailedAt`, `canceling`, expired trial) via a live e2e run (`apps/e2e/tests/billing-enforcement.spec.ts`, 17/17 passing). If the 7-day figure itself is ever revisited, change `PAST_DUE_GRACE_MS` in that one file — do not reintroduce per-app copies. |
| D7 | Trial: **cardless, 14 days, once per user lifetime, first subscription only.** |
| D8 | Usage reset anchored to **subscription billing period** (`currentPeriodStart`), not calendar month. |
| D9 | Only `Subscription.ownerUserId` can manage a subscription. Workspace `billing` role does **not** grant cross-workspace subscription-management permissions. No `Organization` entity. |
| D10 | Growth yearly `t100k` and `t200k` are **both $390, intentionally equal** (confirmed; §3.2 table reflects this; verified against the live Dodo Test Mode catalog and `pricing.tsx`/`products-spec.ts`/`docs/billing-invariants.md` §1). **Correction:** an earlier pass of this document said $590 for `t200k` — that was wrong and has been fixed; the actual shipped product (`pdt_0Nn6GKYzKTrDDuC2E4AbY`) is $390. Do not silently change this pricing elsewhere. |
| D11 | `maxWorkspaces` (30) is **snapshotted per `Subscription`**; raising the global cap later needs a deliberate migration/update to bump existing rows — it does not change automatically. |
| D12 | After full Growth cancellation + later re-subscription, the UI **offers** previously-covered workspaces for re-attachment; no silent auto-attach. |
| D13 | **All 9 tiers are self-serve checkout** — including `t5m`/`t10m`/`t10m_plus`. No sales-led/"Contact us" path. Matches what Deploy 0 (36 products created) and Deploy 3a (all 36 wired into `pricing.tsx`, no tier gating) already shipped. |
| D14 | `Invoice.workspace onDelete` — **Cascade vs SetNull unconfirmed.** This is a non-blocking schema decision; it should **not** block billing implementation and can be handled in a later migration if necessary. |
| D16 | 36 Dodo products (§3.2) with the target tiers/prices are a **launch requirement**; `scripts/dodo-product-audit.ts` gates the relevant deployment. (Already created in test mode per Deploy 0 — live-mode creation + the audit still gate go-live.) |

### Additional assumptions to confirm — implementation/API verification, not product decisions
These (A2–A5, A7, A8) are Dodo SDK/API verification items to nail down during implementation, not open product questions — don't treat them as blocking product decisions.
| # | Assumption |
|---|---|
| A2 | Dodo Checkout Sessions accept an existing `customer_id` to attach (docs say "Attach Existing Customer" — exact SDK field to be confirmed against `dodopayments` types during implementation). |
| A3 | `subscription.plan_changed` / `subscription.updated` webhooks fire for `changePlan` with `do_not_bill` at the time the change **takes effect** (renewal), not only at request time. If Dodo only sends it at request time, the reconciliation cron's `pendingPlanChange.effectiveAt` check is the enforcer (already planned) — but confirm. |
| A4 | Dodo allows `changePlan` between arbitrary products (Standard product ↔ Growth product) — the docs' "migrate users to a new product… without cancelling" implies yes; confirm no product-family restriction exists in the account config. |
| A5 | `dodo.subscriptions.update({ cancel_at_next_billing_date: true })` is the correct call for "cancel at period end" (vs a dedicated `cancel` method with a param). Confirm against SDK. |
| A7 | The 14-day trial length is unchanged from today's implementation (assuming this is confirmed by the existing implementation/product decision). |
| A8 | No requirement for multiple currencies at subscription creation now (Dodo may still bill localised; we record `Subscription.currency` from the webhook, as already planned). |

`A1` (old `WorkspacePlan` → `planTier` backfill map) and `A6` (Enterprise/Ultimate legacy-customer mapping) are **deleted** — both were backfill-only concerns and don't apply with no legacy migration.

---

## 16. Final production-readiness verification (2026-09-14)

What was actually run, against the real repository, after Deploy 5 and the fixes in the "Final production-readiness pass" section near the top:

| Check | Result |
|---|---|
| `pnpm --filter web test` (vitest) | **106/106 pass** (baseline 81 → +25 across this pass: `resolveKeepWorkspaceId`, `isUnsafeDowngradeDetach`, `entitlement.test.ts`'s D6/canceling matrix, `flags.test.ts`, `billing-identity.test.ts`, the Int32-sentinel regression test) |
| `pnpm turbo run check-types` | 5/5 packages clean (`@repo/analytics`, `@repo/db`, `@repo/email`, `@repo/ui`, `@repo/utils`, `e2e`) |
| `tsc --noEmit` (apps/web, apps/ingestion via `tsc` build) | clean |
| `pnpm --filter web build` (next build) | green, exit 0 |
| `pnpm --filter ingestion build` | green, exit 0 |
| `dodo-product-audit.ts --catalog` (offline) | PASS, 36/36 |
| `dodo-product-audit.ts --verify` (**live** Test Mode Dodo API) | **36/36 PASS, 0 FAIL, 0 MISSING, 0 orphan Convrs products** |
| `apps/e2e` — `billing-enforcement.spec.ts` (new, live disposable DB) | **17/17 pass** |
| `apps/e2e` — full suite excluding `@tinybird` | 43/44 first run (1 flake — `workspace-invite.spec.ts`'s accept-flow navigation timeout under cold-compile load, unrelated to billing; isolated re-run: 8/8 pass) |
| `pnpm lint` | **fails** — pre-existing, unrelated: `packages/utils` still has an old-style ESLint config; ESLint 9 needs `eslint.config.js`. Not touched by this pass. |

**Genuinely untested (infrastructure, not code, is the limiter):**
- Real Dodo hosted-checkout completion (a live browser paying with a Dodo test card) — not attempted; would need browser automation against Dodo's actual hosted UI, which is slow/fragile for an audit pass and wasn't in reach here.
- A live Dodo webhook delivered end-to-end from an actual Dodo-side event (as opposed to the processor's own logic, which is covered by unit tests and the reconciliation cron's replay path, itself unit-tested).
- `subscription-service.ts`'s DB-writing paths (`attachWorkspace`, `changePlan`, `consolidateStandardSubs`, etc.) through the real HTTP API end-to-end — covered at the unit level (extracted pure decision functions) but not via a new e2e spec exercising the actual routes; `createStandardSubscription`/`createGrowthSubscription` e2e seed helpers were not built (see §9.5).

---

## This is a clean-start billing implementation, not a legacy billing migration

No backfill, no dual-write, and no legacy-compatibility behavior exists beyond what's documented above as already-shipped historical fact — verified, not just asserted, in this final pass (repo-wide grep for the abandoned backfill/dual-write/legacy-product-id patterns found nothing beyond one deliberate negative test).

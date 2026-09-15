# Convrs Billing / Workspace Architecture Audit

**Date:** 2026-09-07
**Scope:** Read-only audit of the current subscription + workspace model against the target business model:

> **1 Workspace = 1 Website.** A user may own many workspaces.
> **Standard** = one subscription covers **exactly 1 workspace**. A user may hold **multiple independent Standard subscriptions** (one per site).
> **Growth** = one subscription covers **up to 30 workspaces**.
> When a user with a Standard site clicks **Add Website**, they choose: buy another Standard subscription, **or** move to a Growth subscription that covers up to 30 sites.
> The rule "a Standard user must upgrade to Growth to create site #2" is **explicitly wrong** and must not be implemented.

**AUDIT ONLY — no code changed.**

---

## 0. TL;DR

The current model is **hard 1:1 — one Workspace row *is* the subscription record**. All Dodo billing state lives as columns directly on `Workspace` (`dodoCustomerId`, `dodoSubscriptionId`, `subscriptionStatus`, `planFamily`, `plan`, period dates, trial date, usage limits). Both `dodoCustomerId` and `dodoSubscriptionId` are `@unique` **on the Workspace table**.

This cannot represent either target rule:

- **Standard "many independent subs per user"** partly works by accident (each workspace is its own island), **but breaks on `dodoCustomerId @unique`**: the same Dodo customer (same billing email) can only ever be attached to *one* workspace row. The webhook code already contains a defensive hack that **silently skips writing `dodoCustomerId`** for a user's 2nd paid workspace (`subscription-active.ts:305-321`), which then **breaks the customer portal** for that workspace (`billing/manage/route.ts:9` requires `workspace.dodoCustomerId`).
- **Growth "one sub covers 30 workspaces"** is impossible: there is no entity that a workspace can point *at*. `dodoSubscriptionId @unique` on Workspace means one subscription ↔ one workspace, permanently.
- **Nothing anywhere counts or caps the number of websites.** `POST /api/workspaces` creates unlimited workspaces with no billing check. There is no "seats" concept.

**Recommendation:** introduce a dedicated **`Subscription`** model owned by a `User`, with `Workspace.subscriptionId` as a nullable FK. Move `dodoCustomerId` to `User`. Keep a **denormalized** copy of `subscriptionStatus` / `plan` / `planFamily` / `usageLimit` / `currentPeriodEnd` on `Workspace` (written by a webhook fan-out) so the two hot read paths (`apps/ingestion` track handler, dashboard layout gate) don't need a join. **Do not** introduce a full `Organization`/multi-user billing-account entity yet — the stated rules don't require it and it would touch auth/RBAC/invites/every tenant query.

---

## 1. Current Workspace ↔ subscription relationship

**File:** `packages/db/schema/workspace.prisma:66-157`

Billing is a set of columns on `Workspace`:

| Column | Type | Notes |
|---|---|---|
| `dodoCustomerId` | `String? @unique` | **@unique — the core blocker** |
| `dodoSubscriptionId` | `String? @unique` | **@unique — 1:1 with workspace, permanently** |
| `subscriptionStatus` | `SubscriptionStatus @default(inactive)` | `inactive / trialing / active / past_due / canceling / canceled / expired` |
| `billingInterval` | `BillingInterval?` | `month / year` |
| `planFamily` | `PricingFamily @default(standard)` | enum `standard / growth` |
| `plan` | `WorkspacePlan @default(free)` | enum `free / starter / basic / pro / growth / business / scale / pro_plus / enterprise / ultimate` — the **event tier**, confusingly also contains a value named `growth` |
| `currentPeriodStart` / `currentPeriodEnd` | `DateTime?` | |
| `freeTrialEndDate` | `DateTime?` | cardless trial end |
| `cancelAtPeriodEnd` | `Boolean @default(false)` | (written nowhere — `subscription-cancelled.ts` uses `subscriptionStatus = "canceling"` instead) |
| `usage` / `tierEvents` / `usageLimit` | `Int @default(0)` | per-workspace event counters |
| `paymentFailedAt` | `DateTime?` | |
| `invoicePrefix` | `String? @unique` | |

Indexes: `@@index([dodoSubscriptionId])`, `@@index([dodoCustomerId])`, `@@index([subscriptionStatus])`, `@@index([plan])`.

There is **no** `Subscription` / `BillingAccount` / `Organization` model. `Payment` and `CustomerSubscription` (`packages/db/schema/payment.prisma`) are the *customer's* revenue data (Convrs attributing the customer's own sales) — **a completely separate concern**, do not conflate.

**Schema drift to be aware of:** `apps/web/lib/zod/schemas/workspaces.ts` (the `WorkspaceSchema` used to serialize every workspace API response) still declares `stripeId`, `stripeCustomerId`, `stripeSubscriptionId`, `billingCycleStart`, `planTier` — **none of which exist on the model**. They're all `.optional()` / `.nullable()` so `.parse()` doesn't throw, but any UI reading `workspace.stripeSubscriptionId` gets `undefined`.

---

## 2. Current User ↔ Workspace relationship

**Files:** `packages/db/schema/schema.prisma:9-32`, `workspace.prisma:171-185`

- `WorkspaceUsers` join table: `(userId, workspaceId)` unique, `role ∈ {owner, member, viewer, billing}`.
- `User.defaultWorkspaceId String?`
- `User.freeTrialUsedAt DateTime?` — **a per-user, lifetime trial flag** (see §10).
- `POST /api/workspaces` (`apps/web/app/api/workspaces/route.ts:49`) — creates a workspace with `subscriptionStatus: "inactive"`, `plan: "free"`, adds the caller as `role: "owner"`. **No limit, no billing check, no plan gate.**
- `GET /api/workspaces` and `/api/workspaces/calculate` return every workspace the user is a member of. `use-workspaces.ts` reads `/calculate`.
- `withWorkspace` (`apps/web/lib/auth/workspace.ts`) scopes by membership and, as a side effect on every request, **flips an expired `trialing` workspace to `inactive`** (lines 97-113). This is per-workspace and will misbehave with a shared Growth trial (§10).
- There is a `WorkspaceRole.billing` role but it is **workspace-scoped** — it does not let a teammate manage a subscription that spans multiple workspaces.

**Conclusion:** the only user↔billing linkage today is transitive: `User → WorkspaceUsers(owner) → Workspace.dodo*`. There is no "this user's subscriptions" concept.

---

## 3. Do we need a BillingAccount / Organization entity?

**Recommendation: add a `Subscription` entity owned by `User`. Do NOT add a full `Organization`.**

**Why a `Subscription` entity is unavoidable:**

- Growth = **1 subscription → N workspaces**. A one-to-many needs the "one" side to be a row. Encoding it as duplicated columns across 30 `Workspace` rows guarantees drift (a `subscription.plan_changed` webhook would have to update 30 rows transactionally; a partial failure leaves sites disagreeing about the plan).
- Standard = a user holds **several** subscriptions. There must be a table with several rows per user.
- `dodoCustomerId` must be **one per buyer**, not one per workspace — otherwise the customer portal, invoices, and payment-method endpoints can only ever work for the first workspace (this is already broken, §0).

**Why NOT a full `Organization` / multi-user billing account:**

- The stated rules only need two facts: *"which subscription covers this workspace"* and *"who owns this subscription"*. Both are satisfied by `Workspace.subscriptionId` + `Subscription.ownerUserId`.
- An `Organization` would ripple into `WorkspaceUsers`, RBAC (`lib/api/rbac/*`), invites (`WorkspaceInvite`), SAML/SCIM tenant resolution (`lib/jackson.ts` keys connections by `workspace.id`), and every `prisma.workspace.findMany({ where: { users: { some: … } } })` call. That is a multi-week refactor for zero benefit to the current business rules.
- **Accepted limitation:** the subscription owner is a single `User`. If that user leaves a team, transferring billing ownership needs a manual/admin path. Add `Organization` later *only* when (a) teammates must manage cross-workspace billing, or (b) workspaces must move between billing owners.

---

## 4. Representing multiple independent Standard subscriptions

Each Standard purchase → **its own `Subscription` row**, `planFamily = standard`, `maxWorkspaces = 1`, its own `dodoSubscriptionId`, its own billing period and (optionally) its own trial. Exactly one `Workspace` points at it via `subscriptionId`.

Dodo side: nothing special — each is an ordinary Dodo subscription against a Standard `product_id`. Dodo already supports many subscriptions per customer, so all of a user's Standard subs share **one** `User.dodoCustomerId`.

Enforcement: when attaching/creating a workspace under a Standard subscription, assert `count(Workspace where subscriptionId = X) === 0` (or `< subscription.maxWorkspaces`).

---

## 5. Representing one Growth subscription covering up to 30 workspaces

One `Subscription` row, `planFamily = growth`, `maxWorkspaces = 30` (snapshot the number onto the row so a later config change doesn't retroactively shrink someone's plan). Up to 30 `Workspace` rows carry `subscriptionId = <that row>`.

- Coverage count = `count(Workspace where subscriptionId = X)` (max 30). *(Superseded by `docs/billing-invariants.md`: "seat" is internal jargon only — never user-facing; and a second Growth subscription is **not** an option.)*
- Adding a website when 30 are already covered is refused; UI offers a **new Standard subscription** or **removing an existing website from Growth first** — never a second Growth subscription (one Growth per user).
- Dodo bills a **flat Growth price for the tier** regardless of how many of the 30 websites are covered (the price tables in §20 are per-plan). So there is **no `quantity` / metered call to Dodo** when a workspace is added or removed — coverage count is purely a Convrs-side constraint.
- Event limits still apply **per workspace** (§13).

---

## 6. How a workspace determines which subscription covers it

`Workspace.subscriptionId` (nullable FK → `Subscription`, `onDelete: SetNull`).

- `subscriptionId = null` → uncovered → dashboard redirects to `/{slug}/billing`, ingestion rejects events.
- Coverage is "valid" when the parent subscription's `status ∈ {active, trialing}` (and, per current behavior, arguably `past_due` for a grace window — currently inconsistent, §15).
- **Keep a denormalized `Workspace.subscriptionStatus` / `plan` / `planFamily` / `usageLimit` / `currentPeriodEnd` / `freeTrialEndDate` / `paymentFailedAt`**, written by the webhook fan-out (§12). Rationale:
  - `apps/ingestion/src/controllers/track.ts:113-151, 212-221` reads `workspace.subscriptionStatus` and `workspace.usageLimit` on **every tracked event** — the hottest path in the system. A join per event is unacceptable.
  - `[slug]/layout.tsx` → `hasWorkspaceAccess` reads workspace-only on every dashboard navigation.
  - `apply-subscription.ts` already writes plan state onto the workspace row — the fan-out is a natural extension of what exists.
- `Subscription` is the **source of truth**; workspace columns are a **cache**. Add a nightly reconciliation cron (§15) to correct drift.

---

## 7. How "Add Website" decides: new Standard checkout vs. attach to existing Growth

Proposed decision tree (server resolves; UI renders the options):

1. **Create the `Workspace` immediately** with `subscriptionId = null`, `subscriptionStatus = "inactive"`. (Same as today — cheap, lets the user finish naming/domain before paying.)
2. Compute the user's billing context:
   - `growthSub = Subscription where ownerUserId = me AND planFamily = growth AND status ∈ {active, trialing}` with `usedSeats < maxWorkspaces`.
   - `hasAnyBilling = any Subscription where ownerUserId = me`.
   - `trialAvailable = user.freeTrialUsedAt == null`.
3. Present on the billing step:
   - **If `growthSub` exists with a free seat:** primary CTA **"Add to your Growth plan (`used`/30 sites used)"** → one click, no checkout: set `workspace.subscriptionId = growthSub.id`, fan-out denormalized fields, done.
   - **Always** offer **"New Standard subscription for this site"** → Dodo Checkout Session, `metadata = { intent: "standard", targetWorkspaceId, ownerUserId }`.
   - **If the user has ≥1 Standard sub:** offer **"Switch to Growth — one plan for up to 30 sites"** → Growth Checkout Session, `metadata = { intent: "growth", ownerUserId }`; on activation, consolidate (§8).
   - **If `trialAvailable` and no billing:** offer the 14-day trial path (cardless) for the chosen family (§10).
4. Webhook `subscription.active` (§12) upserts the `Subscription`, links the target workspace(s), fans out.

**This never forces "upgrade to Growth to add site #2".** Standard-buying is a first-class, always-visible option.

---

## 8. User has several Standard subs, then buys Growth

**Goal:** end state is one Growth subscription covering all their sites; the redundant Standard subs are cancelled.

Recommended flow ("consolidate on Growth activation"):

1. User picks "Switch to Growth" → new Growth Checkout Session (or, if they have exactly one Standard sub and want in-place, `dodo.subscriptions.changePlan(standardSubId, { product_id: <growth tier> })` — Dodo treats it as just another `product_id`).
2. On `subscription.active` for the Growth sub:
   - Create/mark the Growth `Subscription`.
   - Re-point every `Workspace` currently under one of this user's Standard subs to the Growth sub (respecting the 30 cap; if they somehow have >30 sites, block and make them choose).
   - Cancel each now-empty Standard sub via Dodo (`cancel_at_next_billing_date` to avoid clawback complexity, or immediate with proration — a business decision). Mark those `Subscription` rows `canceling` / `canceled`.
   - Fan out Growth plan/limits/`planFamily = growth` to all linked workspaces → **X/Reddit attribution now unlocks for all of them** (§14).
3. Edge: if a Standard sub's Dodo cancellation fails, keep retrying via the reconciliation cron; do **not** leave the user double-billed silently — alert.

**Simplest subset that covers the common case (1 Standard sub → Growth):** just `changePlan` that sub to a Growth `product_id`, bump `maxWorkspaces` to 30 on the row, done. No consolidation needed.

---

## 9. Growth customer downgrades to Standard while they have >1 website

Standard's `maxWorkspaces = 1`, so a Growth sub with 5 linked workspaces cannot become Standard as-is.

**Recommended:** the downgrade UI **blocks** until the user resolves the excess. Present: *"Standard covers 1 website. You have 5. Choose which one stays on this plan; the other 4 will need their own subscription or will be deactivated."*

- The user picks the 1 workspace to keep → `changePlan` to Standard `product_id`, set `maxWorkspaces = 1`, that workspace stays linked.
- The other 4: `subscriptionId = null`, `subscriptionStatus = "inactive"` at period end → they hit the billing wall (existing gate) and can each buy their own Standard sub.
- Do the actual `changePlan` with `effective_at: "next_billing_date"` (matches current downgrade behavior in `billing/upgrade/route.ts:275`) so access continues until the period ends; schedule the workspace unlinking for the same moment (reconciliation cron or a `subscription.updated` that reports the new plan).

Never silently pick which workspace survives — that's destructive and non-obvious.

---

## 10. Trial model

**Current implementation (verified):**

- `POST /api/workspaces/[idOrSlug]/billing/start-free-trial` (`start-free-trial/route.ts`): 14-day cardless trial. In a `Serializable` transaction it checks **`user.freeTrialUsedAt`** — if set, throws `TRIAL_ALREADY_USED` (403). Otherwise sets `user.freeTrialUsedAt = now` **and** `workspace.freeTrialEndDate`, `subscriptionStatus = "trialing"`, `plan = "free"`, `tierEvents/usageLimit = Starter (10k)`, `dodoCustomerId/dodoSubscriptionId = null`.
- `create-workspace-form.tsx:onSubmit` calls `createWorkspace` then **unconditionally calls `startFreeTrial`** for every new workspace. For a user's 2nd+ workspace this 403s and the form shows a soft warning toast ("Workspace created, but trial setup failed. Visit billing to activate.") — the workspace is left `inactive`.
- Converting a cardless trial to paid: `billing/upgrade/route.ts:297-323` — if `!workspace.dodoSubscriptionId && subscriptionStatus === "trialing"`, it injects `subscription_data.trial_period_days = getRemainingTrialDays(freeTrialEndDate)` into the Dodo Checkout Session so Dodo captures the card now and charges when the local trial would have ended.

**So today: trial is effectively once-per-user-lifetime, attached to the first workspace, cardless.**

**Recommended model (cleanest, minimal abuse surface):**

- **Trial belongs to the `Subscription`, gated once per user.** Keep `User.freeTrialUsedAt`. The **first** subscription a user starts (Standard or Growth) may be a 14-day cardless trial (`Subscription.status = "trialing"`, `trialEndsAt`, no `dodoSubscriptionId`). Every subsequent subscription requires immediate checkout — **no second trial**.
- **Each independently-purchased Standard sub does NOT get its own trial.** (Otherwise: create N workspaces, get N free 14-day Standard trials — trivial abuse.)
- **Adding a website under an existing (already-charging or trialing) Growth sub:** the new workspace inherits the sub's state instantly — same `trialEndsAt`, no separate trial, no charge event. It just consumes a seat.
- **Adding a website while your first workspace is mid-trial (Standard trial):** the new site can't ride the Standard trial (Standard = 1 site). Offer: (a) start its own Standard sub (paid, card required), or (b) convert the whole account to a Growth trial *if trial hasn't been "used up"* — simpler to just say the trial is spent once started and (b) is a paid Growth checkout with `trial_period_days` = remaining days, mirroring the existing conversion logic.
- Denormalize `trialEndsAt → workspace.freeTrialEndDate` for all linked workspaces via fan-out, so `free-trial-banner.tsx` and `hasWorkspaceAccess` keep working unchanged.
- Move the "expired trial → inactive" flip out of `withWorkspace` (per-request, per-workspace) into the reconciliation cron / webhook, keyed on the `Subscription`, so all sibling workspaces flip together.

---

## 11. How Dodo customer IDs and subscription IDs should be stored

| Field | Today | Proposed |
|---|---|---|
| Dodo customer id | `Workspace.dodoCustomerId @unique` | **`User.dodoCustomerId @unique`** (one per buyer). Also mirror onto `Subscription.dodoCustomerId` (non-unique) for webhook convenience. |
| Dodo subscription id | `Workspace.dodoSubscriptionId @unique` | **`Subscription.dodoSubscriptionId @unique`** (nullable while cardless-trial). |
| Product / tier / family / interval | derived per-webhook from `product_id` via `getPlanFromProductId` | unchanged — store the resolved `plan`, `planFamily`, `billingInterval` on `Subscription`. |

**Migration must drop `@unique` (and the two `@@index`) from the `Workspace` columns** and eventually drop the columns (keep nullable for one release while the fan-out is proven).

---

## 12. How Dodo webhooks should identify billing/subscription/workspace relationships

**Current (`apps/web/app/api/dodo/webhook/`):**

- `route.ts`: verifies signature (`client.webhooks.unwrap`), responds `200` immediately, processes **fire-and-forget** (`processWebhookAsync(event).catch(...)` — not awaited). **No idempotency store** (unlike the customer-revenue `Payment` path which has `@@unique([provider, externalEventId])`).
- `subscription.active` → `subscription-active.ts`: workspace resolved from **`data.metadata.workspaceId`** (set at checkout). Contains the `dodoCustomerId` uniqueness workaround.
- `subscription.updated / renewed / plan_changed / on_hold` → `subscription-updated.ts`: workspace resolved from **`data.subscription_id`** matched against `Workspace.dodoSubscriptionId`.
- `subscription.cancelled / expired` → `subscription-cancelled.ts`: same lookup; on expiry hard-resets to `plan: "free"`, `tierEvents: 10000` (hardcoded), clears ids.
- `applySubscriptionPlan` (`lib/billing/apply-subscription.ts`) does the product_id→plan/family resolution and the single `workspace.update`.
- `updateWorkspacePlan` in `webhook/utils/update-worksapce-plan.ts` is **dead** (imported nowhere; note the "worksapce" filename typo).

**Proposed:**

1. **Add idempotency:** an `WebhookEvent` / `DodoWebhookEvent` table with `@@unique([provider, externalEventId])` (or reuse a Redis set). Skip already-processed `webhook-id`s. Critical once a single event fans out to 30 workspaces + emails.
2. **Checkout metadata** carries `{ ownerUserId, intent: "standard" | "growth", targetWorkspaceId? }`. `targetWorkspaceId` is set for Standard and for "add first workspace to a new Growth sub"; absent for pure Growth top-ups.
3. **`subscription.active`:**
   - Upsert `User.dodoCustomerId` from `data.customer.customer_id` (no uniqueness fight — it's the user's own).
   - Upsert `Subscription` by `dodoSubscriptionId`: resolve `plan/family/interval` via `getPlanFromProductId`, set `maxWorkspaces` from family (1 / 30), `ownerUserId` from metadata.
   - Link workspaces: if `targetWorkspaceId` present, set its `subscriptionId`; for Growth-consolidation, re-point the user's other workspaces per §8.
   - **Fan out** denormalized fields to every linked `Workspace`.
   - Fire onboarding-complete + upgrade email (once, guarded by idempotency).
4. **`subscription.updated / renewed / plan_changed`:** find `Subscription` by `dodoSubscriptionId`, update it, **fan out to all linked workspaces**.
5. **`subscription.cancelled / expired`:** mark `Subscription` `canceling` (period not over) or `canceled` (expired). On `canceled`, for every linked workspace set `subscriptionId = null`, `subscriptionStatus = "inactive"` (drop the hardcoded `tierEvents: 10000`; use `free` tier constant). Growth cancellation deactivates all N sites — the UI must warn hard before initiating.
6. **Move processing off fire-and-forget** onto QStash (already a dependency) so a 30-workspace fan-out that half-fails can retry.

---

## 13. Event limits / usage per website

**Current:** `Workspace.usage` (real counter, incremented in `track.ts:379`), `Workspace.usageLimit` / `tierEvents` (set from `plan.limits.events` by the webhook). `track.ts:215` hard-blocks when `usage >= usageLimit`. A 95%-usage warning email fires once (`track.ts:568-620`, deduped via `SentEmail` type `usage_limit_95`).

**Gaps found:**

- **No monthly usage reset.** `Workspace.usageLastChecked` exists and is indexed, but no cron resets `usage → 0` at period rollover. `vercel.json` crons are `update-exchange-rates`, `weekly-summary`, `traffic-spike`, `social/*` — none reset usage. **Confirm this; if true it's a pre-existing bug** (limits only ever ratchet up).
- Usage check is a **check-then-act race** (`track.ts` reads `usage` early, increments later) — already noted in `docs/engineering-audit.md`. A 30-site Growth plan amplifies concurrent overshoot.

**Recommended for the new model:**

- **Per-workspace limit = the subscription tier's event allowance.** Each linked workspace gets `usageLimit = subscription.tierEvents`. This matches "1 workspace = 1 website" and the flat per-plan pricing (the customer is not buying a shared pool). Fan-out writes `usageLimit` to each workspace on plan change.
- Keep `usage` per-workspace (already correct).
- Add a **usage-reset cron** aligned to `subscription.currentPeriodStart` (or a simple monthly reset), writing `usage = 0`, `usageLastChecked = now` for all workspaces whose subscription rolled over. Trigger the reset from `subscription.renewed` as the primary signal, cron as backstop.
- Make the cap atomic: `updateMany({ where: { id, usage: { lt: usageLimit } }, data: { usage: { increment: 1 } } })` and treat `count === 0` as "over limit".

---

## 14. Growth-only X/Reddit integration entitlement

**Current:**
- `lib/billing/entitlement.ts::workspaceHasSocialAttribution(workspace)` → `workspace.planFamily === "growth"` && tier `unlocksSocialAttribution`.
- Enforced at: `api/workspaces/[idOrSlug]/social/keywords/route.ts:87`, `.../social/attribution-handles/route.ts:111`.
- `lib/billing/social-eligibility.ts` filters cron-worker workspaces with `prisma.workspace.findMany({ where: { planFamily: "growth", … } })` — used by all 5 social cron routes (`x-discovery`, `x-mentions`, `reddit-mentions`, plus `link-resolution` / `attribution-reconciliation`).

**Impact of the new model:** `planFamily` becomes a property of `Subscription`, not intrinsically of `Workspace`. Two choices:

- **(A, recommended) Keep `planFamily` denormalized on `Workspace`** (written by fan-out). Then **all of the above code keeps working unchanged** — `workspace.planFamily`, `where: { planFamily: "growth" }` still resolve. `entitlement.ts` just also checks `subscriptionStatus ∈ {active, trialing}`.
- (B) Make everything join `workspace.subscription.planFamily` — more "correct", but rewrites `social-eligibility.ts` and 5 cron routes and the entitlement helper. Not worth it.

Go with (A). The one real change: when a workspace is **unlinked** (Growth cancelled / seat removed / downgrade), the fan-out must set `planFamily` back to `standard` (or null) so social workers stop picking it up on the next run — `social-eligibility.ts`'s doc comment already relies on "recompute from scratch every run", which continues to hold.

---

## 15. Cancellation / renewal / failed payment / downgrade / upgrade

| Event | Standard (1 workspace) | Growth (N workspaces) |
|---|---|---|
| **Cancel** (scheduled) | `Subscription.status = "canceling"`; workspace keeps access until `currentPeriodEnd`; then unlink → `inactive`. | Same, **for all N**. UI must show "this deactivates all 12 of your sites on <date>". |
| **Renewal** (`subscription.renewed`) | update period dates; **reset `usage → 0`** (fan-out); clear `paymentFailedAt`. | same, fan out to all N. |
| **Failed payment** (`on_hold` / `past_due`) | `Subscription.status = "past_due"`, `paymentFailedAt = now`; fan out. | fan out to all N — all sites enter grace/blocked together. |
| **Upgrade tier** (e.g. 100K→1M) | `dodo.changePlan(..., effective_at: "immediately", prorated_immediately)` (existing logic); webhook updates `Subscription` + fan-out new `usageLimit`. | same; **all N** workspaces get the new per-site limit. |
| **Downgrade tier** | `changePlan(effective_at: "next_billing_date", full_immediately)` (existing); fan out at period end. | same. |
| **Standard → Growth** | §8. | n/a |
| **Growth → Standard** | §9 (blocked until seats reduced to 1). | n/a |

**Inconsistency to fix while here:** `hasWorkspaceAccess` (`check-subscription-status.ts`) grants access only for `active` or valid `trialing` — a `past_due` workspace is **locked out of the dashboard**. But `apps/ingestion/track.ts:146` only blocks `subscriptionStatus === "inactive"` — a `past_due` workspace **keeps ingesting events**. Pick one grace-period policy and apply it in both places.

**`cancelAtPeriodEnd` column is dead** — the cancel handler writes `subscriptionStatus = "canceling"` instead. Either wire it up on `Subscription` or drop it.

---

## 16. Migrating existing customers/subscriptions

One data migration, run after the schema migration adds `Subscription` + `Workspace.subscriptionId` + `User.dodoCustomerId` (and makes the old `Workspace.dodo*` columns non-unique, still present):

1. For every `Workspace` with `dodoSubscriptionId != null`:
   - Create a `Subscription`: `ownerUserId` = the workspace's `owner` `WorkspaceUsers` (if multiple owners, lowest `createdAt`); copy `dodoSubscriptionId`, `dodoCustomerId`, `subscriptionStatus`, `billingInterval`, `plan`, `planFamily`, `tierEvents`, period dates; `maxWorkspaces` = `planFamily === "growth" ? 30 : 1`; `trialEndsAt` = `freeTrialEndDate` if `subscriptionStatus === "trialing"`.
   - Set `Workspace.subscriptionId`.
2. For every `Workspace` with `subscriptionStatus === "trialing"` and no `dodoSubscriptionId` (cardless trial): create a `Subscription` with `status = "trialing"`, `dodoSubscriptionId = null`, `trialEndsAt = freeTrialEndDate`, `planFamily` from the workspace, `maxWorkspaces` per family.
3. Populate `User.dodoCustomerId`: for each user, from any of their workspaces' `dodoCustomerId` (they *should* all match today because of the `@unique` hack; if a user has divergent values because the hack skipped writes, pick the one that actually exists in Dodo — log conflicts for manual review).
4. **Do not** attempt to merge a user's existing separate Standard workspaces into one Growth sub — leave them as N independent Standard `Subscription` rows. Consolidation only happens if/when the user chooses Growth later (§8).
5. Leave `Workspace.dodo*` columns populated but stop writing them for one release; verify the fan-out keeps them in sync; then drop in a follow-up migration.
6. Backfill is idempotent (keyed on `dodoSubscriptionId` unique on `Subscription`) so it can be re-run.

**Risk:** any user who currently has 2+ paid workspaces already has a broken `dodoCustomerId` on the 2nd (the hack). Those need Dodo-side reconciliation (fetch the real customer id for that subscription from Dodo's API) during migration.

---

## 17. Does the current `pricing.ts` structure support this model?

**File:** `packages/utils/src/constants/pricing/pricing.tsx`

**Structurally: mostly yes, with changes.** It already has:
- Two families (`STANDARD_PLANS`, `GROWTH_PLANS`), `PRICING_FAMILIES` registry, `getPlanFromProductId` (returns `{plan, interval, family}`), `getProductId({planName, family, interval})`, cross-family `isDowngradePlan` (price-based).
- `unlocksSocialAttribution` per plan (all Growth = true).
- Hardcoded Dodo `product_id`s for both families ("production" blocks currently active).

**What must change:**

1. **Event tiers don't match the target.** Current: `10k / 25k / 100k / 500k / 1M / 5M / 10M / 15M / 25M` (names Starter…Ultimate). Target: **`10K / 100K / 200K / 500K / 1M / 2M / 5M / 10M / 10M+`**. Different tier count boundaries → **every tier's `limits.events` changes** and a 9th "10M+" tier is a distinct plan (see §20 — it has its own price, higher than the 10M tier; represent its `events` as a sentinel like `Number.POSITIVE_INFINITY` or `10_000_001` and treat the limit as "soft/overage").
2. **Prices don't match** — see §20. All 36 `price.monthly` / `price.yearly` values must be replaced with the exact figures (the file's current Growth prices are explicitly labelled "placeholders, not a pricing strategy").
3. **All 36 Dodo products must be (re)created** (9 tiers × {monthly, yearly} × {standard, growth}) and their real `product_id`s pasted in. Until then `getProductId` returns valid strings that Dodo rejects → checkout 500s. **This is a hard external dependency and a launch blocker.** The file already warns about this for the Growth family.
4. **Tier naming collision:** the Standard family has a tier literally named `"Growth"` (`STANDARD_PLANS[3]`, exported as `Growth_Plan`, and a `WorkspacePlan` enum value `growth`). With "Growth" now the headline *family* name, this is actively confusing in logs/UI/DB. **Rename tiers to their event size** (`"10K"`, `"100K"`, …) — this also simplifies the `WorkspacePlan` enum and the `plan.name.toLowerCase().replace(/\s+/g,"_")` → enum coercion in `apply-subscription.ts:72`.
5. **Add `maxWorkspaces` to the family** (or a `FAMILY_LIMITS = { standard: 1, growth: 30 }` constant) so the webhook and "add website" logic have a single source.
6. `isDowngradePlan` is price-based and already family-safe — keep. But verify the new price ladder is strictly monotonic within each family (it is, per §20) so tier comparisons stay meaningful.
7. Kill the `getPlanFromPriceId = getPlanFromProductId as unknown as …` double-cast (flagged in `docs/engineering-audit.md`).

---

## 18. API routes that need to change

| Route | Change |
|---|---|
| `POST /api/workspaces` (`app/api/workspaces/route.ts`) | Stop auto-starting a trial from the form. Return the workspace `inactive`; the client then goes to the billing step. Optionally accept `{ billingChoice }` to attach to an existing Growth sub in the same call. |
| `POST /api/workspaces/[idOrSlug]/billing/upgrade` | Split responsibilities. Today it conflates "new checkout" and "change plan on the workspace's sub". New: resolve the target **subscription** (existing Growth, or new). Keep `changePlan` path for tier changes on an existing `Subscription`. |
| **NEW** `POST /api/subscriptions` | Start a checkout for a new Standard or Growth subscription (`{ family, tier, interval, targetWorkspaceId? }`). |
| **NEW** `POST /api/workspaces/[idOrSlug]/billing/attach` | Attach an uncovered workspace to one of the caller's Growth subs with a free seat (no checkout). Enforces seat cap. |
| **NEW** `POST /api/subscriptions/[id]/change-plan` | Tier up/down within a family; Standard↔Growth transitions (with the §8/§9 guards). |
| **NEW** `POST /api/subscriptions/[id]/cancel` / `resume` | Cancel/resume; authz by `Subscription.ownerUserId`, not workspace role. |
| `GET /api/workspaces/[idOrSlug]/billing/route.ts` | Read `dodoSubscriptionId` from `workspace.subscription`, not the workspace. |
| `POST /api/workspaces/[idOrSlug]/billing/manage` | Portal session from `user.dodoCustomerId` (fixes the current "2nd workspace can't open portal" bug). |
| `GET /api/workspaces/[idOrSlug]/billing/invoices` & `/payment-methods` | Repoint to `user.dodoCustomerId` / `workspace.subscription.dodoSubscriptionId`. |
| `POST /api/workspaces/[idOrSlug]/billing/start-free-trial` | Create a `Subscription` (status `trialing`) instead of stamping the workspace; still gated by `user.freeTrialUsedAt`. |
| `app/api/dodo/webhook/route.ts` + `subscription-active.ts` + `subscription-updated.ts` + `subscription-cancelled.ts` | Rewrite per §12: idempotency, resolve `Subscription`, fan out to N workspaces, move off fire-and-forget. |
| `lib/billing/apply-subscription.ts` | Operate on `Subscription`; add a `fanOutToWorkspaces(subscriptionId)` helper. |
| `lib/billing/entitlement.ts` | Also require `subscriptionStatus ∈ {active, trialing}`. |
| `lib/api/workspaces/check-subscription-status.ts` | Unchanged if denormalized columns kept; align `past_due` policy with ingestion. |
| `lib/auth/workspace.ts` | Remove the per-request "expired trial → inactive" flip; move to cron/webhook keyed on `Subscription`. |
| `apps/ingestion/src/controllers/track.ts` | No change if denormalized `subscriptionStatus`/`usageLimit` kept. Align `past_due` handling. Fix usage race + add reset (pre-existing). |
| `lib/api/workspaces/delete-workspace.ts` | On workspace delete, free the seat (it already cascades; just ensure no dangling `subscriptionId` logic needed) and consider auto-cancelling a now-empty Standard sub. |
| `lib/zod/schemas/workspaces.ts` | Drop the phantom `stripe*` / `billingCycleStart` / `planTier` fields; add `subscriptionId` + a nested `subscription` summary. |

---

## 19. UI pages / components that need to change

| File | Change |
|---|---|
| `ui/modals/create-workspace-modal.tsx` + `ui/workspaces/create-workspace-form.tsx` | Remove the unconditional `startFreeTrial` call. After create, route to a billing-choice step (or embed it): "Add to your Growth plan (N/30)" vs "New Standard subscription" vs "Switch to Growth". |
| `app/app.convrs.dev/(dashboard)/[slug]/billing/page.tsx` | Currently two hardcoded cards ("$0 then $9/month", "30 websites", "$0 then $19/month"). Rebuild: show current subscription (plan, family, tier, interval, sites used `/ maxWorkspaces`, renewal date, trial banner), tier up/down, Standard↔Growth switch (with §8/§9 guards), "Manage billing" (portal). |
| `ui/upgrade-plan.tsx` (`UpgradePlanButton`) | Already family-aware. Update for new tier names/prices; route through the new `/api/subscriptions` vs `change-plan` split. |
| `ui/upgrade-plan-pricing-card.tsx` | Already family + event-slider based. Update `buildEventTiers` labels for `10M+`, new prices; the `k`/`M` formatter needs a `10M+` case. |
| `app/app.convrs.dev/(onboarding)/onboarding/(steps)/billing/form.tsx` | Currently a **stub returning `<div><h2></h2></div>`**. Build the first-subscription choice (Standard vs Growth, tier, trial). |
| `ui/layout/sidebar/free-trial-banner.tsx` | Reads `workspace.subscriptionStatus` / `freeTrialEndDate` — fine if denormalized; copy tweak for shared Growth trial ("trial covers all your sites"). |
| Sidebar workspace switcher / "Add workspace" button (`ui/layout/sidebar/app-sidebar.tsx`) | Surface coverage per workspace (covered / inactive / trial); show Growth seat usage. |
| `app/app.convrs.dev/(dashboard)/[slug]/settings/integrations/page.tsx` & social settings | Entitlement copy: "X/Reddit attribution requires a Growth plan" — unchanged logic if `planFamily` stays denormalized. |
| `[slug]/layout.tsx` | Unchanged (reads `hasWorkspaceAccess`), assuming denormalized `subscriptionStatus`. |
| A new **"Subscriptions"** account-level page (not workspace-scoped) | List all the user's subscriptions, their linked sites, seat usage, per-sub cancel/upgrade. This is the natural home for cross-workspace billing since there's no Organization page. |

---

## 20. Pricing verification

The pricing currently in `pricing.tsx` **does not match** the target. Target values to hardcode (do not recompute):

### Monthly

| Events | Standard | Growth |
|---|---:|---:|
| 10K | $9 | $19 |
| 100K | $19 | $39 |
| 200K | $29 | $59 |
| 500K | $49 | $99 |
| 1M | $69 | $139 |
| 2M | $89 | $179 |
| 5M | $129 | $259 |
| 10M | $169 | $339 |
| 10M+ | $199 | $399 |

### Yearly

| Events | Standard | Growth |
|---|---:|---:|
| 10K | $90 | $190 |
| 100K | $190 | $390 |
| 200K | $290 | $390 |
| 500K | $490 | $990 |
| 1M | $690 | $1,390 |
| 2M | $890 | $1,790 |
| 5M | $1,290 | $2,590 |
| 10M | $1,690 | $3,390 |
| 10M+ | $1,990 | $3,990 |

Notes (observations, **not** corrections):
- Growth yearly at **200K is $390 — identical to Growth yearly 100K ($390)**. Flagging only so it's a deliberate choice, not a copy-paste error to discover later.
- `10M` and `10M+` are two separate plans/products (different prices), so the tier ladder is **9 tiers**, same count as today.
- These 36 price points → **36 Dodo products** must exist before launch (§17.3).

### Current `pricing.tsx` tests needed

- `getPlanFromProductId` round-trips for all 36 product ids → correct `{plan, family, interval}`.
- `getProductId` returns a non-null id for every `(tier, family, interval)`.
- `isDowngradePlan` monotonic within a family; Standard→Growth same tier = **upgrade** (not downgrade/no-op).
- `10M+` tier: `formatEventLimit` / slider label renders sensibly; entitlement + usage-limit code handles the sentinel value.

---

## 21. Recommended data model (concrete)

```prisma
model User {
  // ...
  dodoCustomerId  String?        @unique   // moved from Workspace
  freeTrialUsedAt DateTime?                 // keep: one lifetime cardless trial
  subscriptions   Subscription[]
}

enum SubscriptionPlanFamily { standard growth }   // == current PricingFamily

model Subscription {
  id                 String   @id @default(cuid())
  ownerUserId        String
  owner              User     @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)

  dodoSubscriptionId String?  @unique          // null during cardless trial
  dodoCustomerId     String?                   // mirror of owner.dodoCustomerId

  planFamily         SubscriptionPlanFamily
  plan               WorkspacePlan             // the event tier
  tierEvents         Int
  billingInterval    BillingInterval?
  status             SubscriptionStatus @default(inactive)

  maxWorkspaces      Int                        // snapshot: 1 (standard) / 30 (growth)

  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  trialEndsAt        DateTime?
  cancelAtPeriodEnd  Boolean  @default(false)
  paymentFailedAt    DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspaces Workspace[]

  @@index([ownerUserId])
  @@index([status])
  @@index([dodoSubscriptionId])
}

model Workspace {
  // ... existing fields ...

  subscriptionId String?
  subscription   Subscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)

  // DENORMALIZED cache of the parent subscription (written by webhook fan-out).
  // Kept because apps/ingestion/track.ts and the dashboard layout read these
  // on the hottest paths and must not join.
  subscriptionStatus SubscriptionStatus @default(inactive)   // keep
  planFamily         PricingFamily      @default(standard)   // keep
  plan               WorkspacePlan      @default(free)       // keep
  tierEvents         Int  @default(0)                        // keep
  usageLimit         Int  @default(0)                        // keep
  currentPeriodEnd   DateTime?                                // keep
  freeTrialEndDate   DateTime?                                // keep (mirrors subscription.trialEndsAt)
  paymentFailedAt    DateTime?                                // keep

  usage Int @default(0)   // stays REAL + per-workspace

  // REMOVE (after one transition release):
  //   dodoCustomerId       String? @unique
  //   dodoSubscriptionId   String? @unique
  //   @@index([dodoSubscriptionId]); @@index([dodoCustomerId])
}
```

**Ownership model:** subscription → `ownerUserId` (single user). Workspace → still `WorkspaceUsers`. Coverage → `Workspace.subscriptionId`.
**Seat rule:** attach allowed iff `count(Workspace where subscriptionId=X) < Subscription.maxWorkspaces`.

---

## 22. Edge cases

1. **Adding a website when a Growth sub already covers 30** → refuse attach; offer new Standard subscription **or** remove an existing website from Growth first (never a 2nd Growth — one per user).
2. **Concurrent-attach race** — two "add website" calls when 29/30 are covered → wrap the count-check + link in a `Serializable` tx (the trial route already uses this isolation level as precedent).
3. **Growth downgrade to Standard with 5 sites** → §9, blocked until reduced to 1.
4. **Two Standard subs, buy Growth** → §8 consolidation.
5. **Standard sub's only workspace deleted** → sub is now empty. Decide: auto-cancel at period end, or let it ride as a "spare seat". Recommend auto-schedule cancel + notify.
6. **Growth sub cancelled** → all N workspaces deactivate together on `currentPeriodEnd`. UI confirmation must list every affected site.
7. **Payment fails on Growth** → all N workspaces `past_due` at once; align dashboard vs ingestion grace policy (§15).
8. **Webhook arrives before our `Subscription` row exists** (checkout→webhook race) → upsert `Subscription` from `metadata` in the `subscription.active` handler; `subscription.updated` that can't find a row returns 200 and waits (as today).
9. **Re-delivered webhook** → idempotency store (§12.1); guard email/onboarding side effects.
10. **`dodoCustomerId` migration collision** — user with a broken 2nd-workspace customer id → reconcile against Dodo API, log.
11. **Teammate (non-owner) tries to add a workspace under the owner's Growth sub** → only `Subscription.ownerUserId` can attach/spend seats. A `role: "billing"` teammate on a workspace still can't touch a cross-workspace subscription (accepted limitation, §3).
12. **Trial abuse** — N workspaces → N Standard trials: prevented by keeping `user.freeTrialUsedAt` as a lifetime gate (§10).
13. **`withWorkspace` trial-expiry flip** with a shared Growth trial → currently would flip one sibling per request; move to `Subscription`-keyed cron.
14. **Currency:** `Subscription` needs its own billing currency (from Dodo); `Workspace.currency` stays a *display* preference for revenue metrics — already separate, keep separate.
15. **`10M+` tier** sentinel event value must not break `usage >= usageLimit` (`Infinity` works), the 95%-warning math (`Math.ceil(Infinity*0.95)` → `Infinity`, warning never fires — acceptable or special-case), and the pricing slider label.
16. **Invoice cascade** — `docs/engineering-audit.md` already flags `Invoice.workspace` has no `onDelete`; deleting a billed workspace throws. Fix alongside (`onDelete: Cascade` or `SetNull`).

---

## 23. Architectural risks

1. **36 Dodo products are a hard launch dependency.** No checkout works until every `product_id` in `pricing.tsx` is real. Build a script that lists Dodo products and diffs against the file.
2. **Denormalization drift.** `Subscription` → `Workspace` fan-out must be reliable. Mitigations: (a) move webhook processing off fire-and-forget onto QStash; (b) nightly reconciliation cron that re-fans-out from `Subscription`; (c) idempotency store so retries are safe.
3. **Fan-out amplifies existing webhook fragility.** Today one webhook = one `workspace.update`. Growth = one webhook → 30 updates + 30 `usageLimit` writes + emails. A partial failure leaves sites disagreeing. Needs a transaction or a durable queue with per-workspace retry.
4. **No webhook idempotency today** (the Dodo path, unlike the customer-`Payment` path). Re-delivery re-runs fan-out and re-sends emails. Must add before fan-out ships.
5. **Authz gap:** all billing endpoints today are `withWorkspace` + `billing:write` (workspace-scoped). A subscription spans workspaces — new endpoints need `Subscription.ownerUserId` checks. Easy to get wrong and leak another user's billing.
6. **`@unique` removal migration** on a live table (`Workspace.dodoCustomerId`, `dodoSubscriptionId`) — plan the Prisma migration carefully; the backfill must run before anything writes a duplicate.
7. **`past_due` policy is already inconsistent** between dashboard (locked out) and ingestion (still ingesting). The fan-out will make this more visible; resolve it deliberately.
8. **Trial semantics change** (per-workspace stamp → per-subscription) touches `start-free-trial`, `create-workspace-form`, `withWorkspace`, `billing/upgrade` trial-conversion, `free-trial-banner`. Get the model decided (§10) before writing code.
9. **Pre-existing: no monthly usage reset** (§13). If confirmed, limits currently only ratchet — shipping stricter per-site limits without a reset would lock customers out permanently.
10. **`WorkspacePlan` enum + string coercion** (`apply-subscription.ts:72` does `plan.name.toLowerCase().replace(/\s+/g,"_")`). Renaming tiers to `"10K"` etc. means the enum values become `10k`… which isn't a valid Prisma enum identifier — either keep internal enum names (`t10k`, `tier_10k`) decoupled from display names, or store `plan` as a plain `String`. Decide before the pricing rename.

---

## 24. Suggested build order

1. **Decide the open product questions:** per-site vs pooled event limits (recommend per-site); trial once-per-user vs per-sub (recommend once-per-user, cardless, first sub only); Standard-empty-sub auto-cancel; `past_due` grace policy.
2. **`pricing.tsx`:** new tiers, exact prices, `FAMILY_LIMITS`, tier rename decision, kill dead casts. Create the 36 Dodo products; paste ids.
3. **Schema:** add `Subscription`, `Workspace.subscriptionId`, `User.dodoCustomerId`; drop `@unique` on `Workspace.dodo*` (keep columns). Migrate data (§16).
4. **Webhook rewrite** (§12): idempotency, `Subscription` resolution, fan-out helper, QStash. This is the riskiest piece — do it with tests first.
5. **New subscription/attach/change-plan/cancel API endpoints** (§18) with `ownerUserId` authz.
6. **"Add Website" flow** (§7): server decision + `create-workspace` UI + onboarding billing step.
7. **Billing page + account-level Subscriptions page** rebuild (§19).
8. **Entitlement + gating alignment** (§14, §15); move trial-expiry flip to cron.
9. **Usage-reset cron** (§13) + atomic cap.
10. **Drop the old `Workspace.dodo*` columns** once the fan-out is proven in production.

---

## 25. Tests to add (none exist for billing today)

- **pricing resolver:** all 36 product-id round-trips; `getProductId` non-null for every combo; `isDowngradePlan` matrix incl. cross-family; `10M+` sentinel handling.
- **seat enforcement:** 2nd workspace under a Standard sub → rejected; 31st under Growth → rejected; concurrent attach at seat 29/30 → exactly one wins.
- **webhook fan-out:** `subscription.plan_changed` on a Growth sub with 30 workspaces → all 30 get new `plan`/`usageLimit`/`planFamily`; idempotent on re-delivery; `subscription.cancelled` unlinks all.
- **Standard→Growth consolidation** (§8): workspaces re-pointed, old Standard subs cancelled.
- **Growth→Standard guard** (§9): blocked with >1 site; succeeds after reduction.
- **trial:** once per user; adding a site under a trialing Growth sub inherits `trialEndsAt`, no new trial; expiry flips all siblings together.
- **entitlement:** `workspaceHasSocialAttribution` true only for `planFamily=growth` + `status ∈ {active,trialing}`; social-cron `getEligiblePlatformsByWorkspace` picks up newly-linked Growth workspaces and drops unlinked ones.
- **portal/invoices:** work for a user's 2nd, 3rd Standard workspace (the current bug).
- **migration script:** idempotent; handles cardless-trial workspaces; flags divergent `dodoCustomerId`.
- **usage:** per-workspace cap is atomic under concurrency; reset cron zeroes `usage` on renewal.
- **authz:** non-owner cannot cancel/upgrade/attach-seat on someone else's `Subscription`.

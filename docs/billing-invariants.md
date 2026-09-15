# Convrs Billing — Blocker Resolution & Invariants

**Date:** 2026-09-07
**Basis:** `docs/billing-architecture-final.md`, `docs/billing-implementation-plan.md`.
**Status:** Resolves the open blockers (D6, D10, D13, D17) and fixes the exact subscription/workspace invariants. **No code written.**

---

## 1. Pricing — LOCKED, verbatim

This is the **authoritative** pricing table (also in `docs/billing-architecture-audit.md §20`). It is **final**. **No price is to be recomputed, rounded, or "corrected."** `apps/web/scripts/dodo/products-spec.ts` and its self-check (`products-spec.test.ts`) parse **this table** as the source of truth.

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

In particular:

| | Growth yearly 100K | Growth yearly 200K |
|---|---|---|
| Price | **$390** | **$390** |

**D10 — RESOLVED:** Growth yearly 100K and 200K are **intentionally the same price ($390)**. Dodo products `growth.t100k.yearly` and `growth.t200k.yearly` are both created at **$390/year**. This is not a typo and must not be changed by anyone during implementation.

### 1.1 One code implication — `isDowngradePlan` tie-break

`isDowngradePlan` in `pricing.tsx` is price-based. For Growth **yearly**, `t100k` ($390) → `t200k` ($390) has **zero price delta**, so a pure price comparison classifies it as "not an upgrade, not a downgrade." Since `t200k` is a higher event tier, this must resolve as an **upgrade-equivalent (more events, same price)**, never a downgrade.

Rule to implement:

```
isDowngrade(current, next) :=
     next.price  <  current.price
  OR (next.price === current.price  AND  next.tierRank < current.tierRank)
```

`tierRank` = index in the fixed ladder `[t10k, t100k, t200k, t500k, t1m, t2m, t5m, t10m, t10m_plus]`.

Proration mode for a **same-price tier change** (only the Growth-yearly 100K↔200K case): use **`do_not_bill`** — applies immediately, **no charge, billing cycle unchanged**. The customer gets the higher event ceiling now for the price they already pay. (All other Growth-tier moves have a real price delta and use `prorated_immediately` for up, `do_not_bill` for down per D4.)

---

## 2. 5M / 10M / 10M+ tiers — self-serve

**D13 — RESOLVED: self-serve Dodo checkout for all 9 tiers, including 5M, 10M, and 10M+.**

- The implementation assumes **self-serve** for every tier in both families. All **36 Dodo products** are created and reachable through the normal checkout / `changePlan` flow.
- **No sales-led / "Contact us" / quote flow is built.** None exists in the codebase today (the retired Enterprise/Ultimate tiers used the same self-serve `UpgradePlanButton` → checkout path), and per your instruction we do not build one unless explicitly required.
- The pricing-card event slider runs the full ladder up to `t10m_plus`.
- `t10m_plus` ("10M+") is a **flat-price, effectively uncapped** tier: `pricing.tsx` sets `limits.events = Number.MAX_SAFE_INTEGER`. Consequences:
  - The ingestion usage gate (`usage < usageLimit`) never trips for `t10m_plus` workspaces — intended (flat $199 / $399, no hard wall).
  - The 95%-usage warning email (`Math.ceil(usageLimit * 0.95)`) **special-cases the sentinel and does not send** for `t10m_plus`.
  - `formatEventLimit(MAX_SAFE_INTEGER)` → `"10M+ events/mo"`.
- If the business later wants top tiers to be sales-led, that is a **separate future change** (add a "Contact us" branch to the pricing card + a lead route); it is explicitly out of scope here.

---

## 3. `past_due` grace period — CONFIRMED

**D6 — RESOLVED.**

**Grace = from `Subscription.paymentFailedAt` until the *earlier* of:**
1. **7 days elapsed**, or
2. Dodo reports the subscription **terminal** (`subscription.cancelled` / `subscription.expired`).

`paymentFailedAt` is set when the `subscription.on_hold` webhook arrives (Dodo's "payment failed, subscription paused") and fanned out to every attached workspace.

### 3.1 What remains fully accessible during grace

A workspace whose subscription is `past_due` **within grace** is treated **exactly like `active`** everywhere. A single shared helper `isEntitled(workspace)` returns `true` for `active`, valid `trialing`, and `past_due`-within-grace; every gate calls it.

| Surface | During grace |
|---|---|
| Dashboard (all pages) | Full read **and** write — analytics, settings, exports, funnels, KPI config, revenue integrations |
| `POST /api/track` (ingestion) | Events **accepted and counted** against `usageLimit` |
| `POST /api/ai-crawls` (AI-bot events) | Accepted |
| Growth X/Reddit attribution (`workspaceHasSocialAttribution`, social cron workers) | **Still runs** — grace means "we expect payment," features are not degraded mid-grace |
| Customer portal / billing page | Available (this is where they fix the card) |
| API / restricted tokens | Unaffected |

**Nothing is removed or hidden during grace.** The only change is a **persistent in-app banner** ("Payment failed — update your payment method") linking to the Dodo customer portal, plus escalating email reminders (Dodo's own dunning runs in parallel).

### 3.2 After grace ends

- If Dodo recovered the payment first → `subscription.active` webhook → `status = active`, `paymentFailedAt = null`, banner clears. No interruption occurred.
- If grace expires with no recovery → the reconciliation cron (or `subscription.expired` webhook) transitions the subscription to `canceled`:
  - every attached workspace: `subscriptionId = null`, cache → `INACTIVE_BASELINE` (`subscriptionStatus = "inactive"`).
  - dashboard → redirect to `/{slug}/billing`; `POST /api/track` → `403`.
  - **All data retained** (tracked events, customers, revenue, Tinybird). Re-subscribing re-attaches (see §7.7).
- For a Growth subscription, **all N workspaces** transition together.

### 3.3 Assumption to verify (A9)

Dodo's built-in **Subscription Dunning** retry schedule for failed renewals must be **≤ 7 days** on the account config. If Dodo's dunning window is longer, our 7-day cap could revoke access while Dodo is still retrying (bad UX — customer might pay on day 9). Mitigation is already built into the rule above: grace also holds *while the Dodo subscription is non-terminal*, so as long as Dodo keeps the sub in `on_hold`, we keep grace — the 7-day figure is the **backstop for cardless / unknown states**, not a hard cutoff that fights Dodo. Confirm the dunning setting during implementation and align if needed.

---

## 4. Core subscription / workspace invariant

### 4.1 Structural facts

```
User 1───N Subscription 1───N Workspace          (Workspace.subscriptionId nullable FK, onDelete: SetNull)

Subscription.planFamily = "standard"  ⟹  maxWorkspaces = 1
Subscription.planFamily = "growth"    ⟹  maxWorkspaces = 30
```

### 4.2 The invariant, stated precisely

| Rule | Statement | Enforced by |
|---|---|---|
| **I-1** | A **Standard** subscription covers **exactly 1** workspace. | `planFamily="standard" ⟹ maxWorkspaces=1` set at creation; DB CHECK `("planFamily"='standard' AND "maxWorkspaces"=1) OR ("planFamily"='growth' AND "maxWorkspaces"=30)`; attach guard. |
| **I-2** | A **Growth** subscription covers **0–30** workspaces (target 1–30; 0 is a transient/edge state, not an error). | `planFamily="growth" ⟹ maxWorkspaces=30`; same CHECK; attach guard `workspaceCount < maxWorkspaces`. Reconciliation flags a Growth sub with 0 workspaces > 7 days. |
| **I-3** | A workspace belongs to **at most one** subscription. `subscriptionId` null ⇒ uncovered. | Single nullable FK column — structurally impossible to violate. |
| **I-4** | `count(Workspace WHERE subscriptionId = S.id) ≤ S.maxWorkspaces` for **every** subscription S, at **all** times. | Atomic guarded increment on `attach`; recompute (never increment) in webhook/detach; reconciliation cron asserts + alerts. |
| **I-5** | `S.workspaceCount === count(Workspace WHERE subscriptionId = S.id)` — the denormalized counter never drifts. | Only mutated via: (a) guarded `+1` in `attach`, (b) `count()` recompute in `detach` / webhook / reconcile. Reconciliation asserts equality hourly. |
| **I-6** | Adding a website under a **Growth** subscription creates **no** new Dodo subscription, **no** new `Subscription` row, **no** payment, **no** `changePlan` call. | The `attach` endpoint makes **zero `dodo.*` calls**. Test asserts no Dodo SDK call on that path. It only: `INSERT Workspace` → `UPDATE Workspace SET subscriptionId` → `UPDATE Subscription SET workspaceCount` → fan-out. |
| **I-7** | A Standard user adding website #2 is **always** offered both: (a) new Standard subscription, or (b) Growth. No code path forces Growth. | `POST /api/subscriptions` accepts `intent:"standard"` unconditionally; `/api/billing/context` + UI always render both cards when the user is not already on Growth. |
| **I-8** | Every workspace with `subscriptionId != null` has denormalized fields (`subscriptionStatus`, `planFamily`, `planTier`, `tierEvents`, `usageLimit`, `currentPeriodEnd`, `freeTrialEndDate`, `paymentFailedAt`) **equal to** the parent subscription's derived values. | Single writer: `fanOutSubscription` + `attach`/`detach`. Reconciliation asserts + repairs. |
| **I-9** | Every workspace with `subscriptionId = null` has cache = `INACTIVE_BASELINE` (`subscriptionStatus="inactive"`, `planFamily="standard"`, `planTier=null`, `tierEvents=0`, `usageLimit=0`, `currentPeriodEnd=null`, `freeTrialEndDate=null`). | `detach` and the terminal-status webhook branch write the baseline in the same statement that nulls the FK. Reconciliation asserts. |
| **I-10** | `Subscription.dodoSubscriptionId` is unique (DB `@unique`), and null **only** while `status="trialing"` on a cardless trial that never converted. | DB constraint; webhook binds it on first `subscription.active`; a non-trialing sub with null `dodoSubscriptionId` is a reconciliation alert. |
| **I-11** | One Dodo customer per user: `User.dodoCustomerId @unique`; every `Subscription.dodoCustomerId` for that user equals `User.dodoCustomerId` (post-migration; pre-migration conflicts tracked in `dodo_customer_conflicts.csv`). | Checkout always attaches the existing `customer_id`; DB unique on `User`. |
| **I-12** | A user has **at most one** non-terminal Growth subscription (see §6). | Partial unique index `WHERE planFamily='growth' AND status NOT IN ('canceled','expired')`; service-layer guard. |
| **I-13** | A user may simultaneously hold **N Standard subscriptions + at most 1 Growth subscription**. Each workspace attaches to exactly one of them. | Emergent from I-3, I-12; no extra enforcement needed. |
| **I-14** | Exactly **one free trial per user, lifetime** (`User.freeTrialUsedAt`). It lives on the user's **first** subscription. Every later subscription is immediately paid, no trial. | Set `freeTrialUsedAt` in the same `Serializable` transaction that creates the first trialing subscription; `createSubscriptionCheckout` passes `trial_period_days` only when `freeTrialUsedAt == null`. |
| **I-15** | `Subscription.pendingPlanChange`, once written, is **eventually applied or explicitly cleared** — never left stale. | Applied by the `plan_changed`/`renewed` webhook when `effectiveAt <= now`; reconciliation cron applies overdue ones and clears them; a `pendingPlanChange` older than `effectiveAt + 48h` is an alert. |
| **I-16** | Workspace data is **never deleted** by any billing operation (downgrade, cancel, expiry, consolidation, detach). Only `Workspace.subscriptionId` is nulled and the cache reset. | No billing code path calls `workspace.delete` or a cascading delete; `Workspace.subscription` FK is `onDelete: SetNull`. Test asserts row counts for `TrackedEvent`/`Customer`/`Payment` are unchanged across every downgrade/cancel scenario. |

### 4.3 `INACTIVE_BASELINE` (canonical constant)

```ts
const INACTIVE_BASELINE = {
  subscriptionId: null,
  subscriptionStatus: "inactive",
  planFamily: "standard",
  planTier: null,
  tierEvents: 0,
  usageLimit: 0,
  currentPeriodEnd: null,
  freeTrialEndDate: null,
  paymentFailedAt: null,
  // usage is NOT reset here — historical usage of a paused workspace is retained
};
```

---

## 5. Standard → Growth transition (exact)

**Precondition:** user owns **exactly one** subscription `S` (planFamily `standard`, covering workspace `W1`), `status ∈ {active, past_due}` **with a bound `dodoSubscriptionId`**. (Trialing-cardless `S` takes the checkout path — see step 4b.)

```
1. POST /api/subscriptions/[S]/change-plan { targetFamily:"growth", targetTier, targetInterval }
   auth: session.user.id === S.ownerUserId
2. validate: S.planFamily === "standard"; S.dodoSubscriptionId != null; target product exists
3. productId = getProductId({ family:"growth", tier:targetTier, interval:targetInterval })
4a. status ∈ {active, past_due}:
      dodo.subscriptions.changePlan(S.dodoSubscriptionId, {
        product_id: productId, quantity: 1,
        proration_billing_mode: "prorated_immediately",   // standard→growth is always a price increase
        effective_at: "immediately",
        on_payment_failure: "prevent_change",
      })
      └─ throws  → ABORT. Nothing in our DB changed. Return mapped Dodo error.
4b. status === "trialing" (cardless, dodoSubscriptionId == null):
      NOT changePlan. Route through checkout:
        createSubscriptionCheckout({ intent:"growth", tier, interval,
          internalSubscriptionId: S.id,           // reuse the row
          trial_period_days: getRemainingTrialDays(S.trialEndsAt) })
      → webhook subscription.active binds S.dodoSubscriptionId, flips S to growth, preserves trialEndsAt
      (freeTrialUsedAt already set — no new trial granted)
5. (path 4a only) one $transaction:
      S.planFamily      = "growth"
      S.maxWorkspaces   = 30
      S.planTier        = targetTier
      S.tierEvents      = <growth tier events>
      S.billingInterval = targetInterval-as-enum
      S.dodoProductId   = productId
      fanOutSubscription(S.id, tx)        // W1 → planFamily="growth"  ⇒ X/Reddit attribution unlocks now
      fanOutLegacyColumns(S.id, tx)       // until Deploy 6
6. webhook subscription.plan_changed(S.dodoSubscriptionId) arrives → processor resolves S by
   dodoSubscriptionId → re-applies identical end state (idempotent) → sets lastEventAt,
   refreshes currentPeriodStart/End (Dodo reset the cycle under prorated_immediately)
7. S.id unchanged ⇒ W1.subscriptionId still valid. No workspace re-pointing.
8. user may now POST /api/workspaces/[Wn]/billing/attach { subscriptionId: S.id }  for W2…W30
```

**The Standard subscription is neither cancelled nor replaced** — `S` (our row) and `S.dodoSubscriptionId` (Dodo's subscription) are the same records, now Growth. Invoice history, payment method, and every `Workspace.subscriptionId` FK are preserved.

**Charge:** the `prorated_immediately` delta only (Growth price − Standard price for the remaining days). Billing cycle resets to today.

---

## 6. Multiple Standard subscriptions → Growth (exact)

**Precondition:** user owns Standard subs `S_A → W1`, `S_B → W2`, `S_C → W3` (generalises to N). At most one may be trialing; the **survivor is always a paid sub** (`active`/`past_due`, bound `dodoSubscriptionId`). If the user has *only* a trial + wants Growth, that is §5 step 4b, not consolidation.

### 6.1 Which subs are cancelled

- **Survivor** = the paid Standard sub with the **furthest `currentPeriodEnd`** (most prepaid value preserved). It becomes Growth via `changePlan`.
- **All other Standard subs are cancelled** (`cancel_at_next_billing_date: true`).
- A non-survivor sub that is a **cardless trial** (no `dodoSubscriptionId`) is not "cancelled" at Dodo — it is marked `status="canceled"`, `workspaceCount=0` locally, and its workspace re-pointed. `freeTrialUsedAt` stays set.

### 6.2 Exact order of operations (failure-safe)

```
0. auth: session.user.id === S_A.ownerUserId (== S_B.ownerUserId == S_C.ownerUserId)
1. validate: count(W1..W3) ≤ 30
2. pick survivor S_A (furthest currentPeriodEnd among paid subs)
3. WRITE the plan first, so recovery is possible:
      S_A.pendingPlanChange = {
        kind: "consolidate",
        toFamily: "growth", toTier, toInterval,
        absorbSubscriptionIds: [S_B.id, S_C.id],
        moveWorkspaceIds: [W2.id, W3.id],
      }
   (plain row update — safe, idempotent)
4. dodo.subscriptions.changePlan(S_A.dodoSubscriptionId, {
      product_id: growthProduct, quantity: 1,
      proration_billing_mode: "prorated_immediately", effective_at: "immediately",
      on_payment_failure: "prevent_change",
   })
   └─ throws → ABORT. Clear S_A.pendingPlanChange. Nothing else changed.
5. one $transaction (this is "apply the pending consolidation"):
      S_A.planFamily="growth", maxWorkspaces=30, planTier, tierEvents, billingInterval, dodoProductId
      W2.subscriptionId = S_A.id
      W3.subscriptionId = S_A.id
      S_A.workspaceCount = (SELECT count(*) FROM "Workspace" WHERE "subscriptionId" = S_A.id)   // = 3
      S_B.status = "canceling", S_B.workspaceCount = 0
      S_C.status = "canceling", S_C.workspaceCount = 0
      fanOutSubscription(S_A.id, tx)      // W1,W2,W3 → Growth entitlement
      fanOutLegacyColumns(S_A.id, tx)
      S_A.pendingPlanChange = null
   └─ throws → transaction rolls back. W2/W3 still on S_B/S_C (still covering them). No gap, no data loss.
      S_A.pendingPlanChange persists ⇒ webhook + reconciliation complete it later (idempotent).
6. AFTER the transaction commits:
      dodo.subscriptions.update(S_B.dodoSubscriptionId, { cancel_at_next_billing_date: true })
      dodo.subscriptions.update(S_C.dodoSubscriptionId, { cancel_at_next_billing_date: true })
   └─ any failure → row in billing_reconcile_queue + alert. SAFE direction: workspaces already on Growth.
7. webhooks: plan_changed(S_A) → idempotent confirm + applies any still-pending consolidation.
   cancelled(S_B), cancelled(S_C), later expired(S_B/S_C) → idempotent no-ops (workspaces already moved).
```

### 6.3 Billing / proration

- **S_A → Growth:** `prorated_immediately` — customer is charged the prorated delta (Growth − Standard for the remaining days of S_A's cycle). Cycle resets to today.
- **S_B, S_C:** `cancel_at_next_billing_date: true` — **no charge, no refund.** They simply stop renewing. The already-paid remainder of S_B/S_C is functionally redundant (those workspaces are already covered by Growth) but is **not** refunded and **not** converted to credit (a `cancel now` credit would be sub-scoped to a dying subscription and lost).
- **Net cost to customer:** Growth from today **plus** the unexpired tails of S_B/S_C running out. Bounded by the shortest remaining Standard period.
- If the business wants to compensate the overlap: a **manual goodwill coupon on the Growth subscription** (D2) — not automated.

### 6.4 Preventing duplicate charges

- The **only** charge in the whole flow is the single `prorated_immediately` delta on S_A.
- `cancel_at_next_billing_date` charges nothing.
- The single-survivor path uses **`changePlan` on an existing subscription** — it never creates a *new* Dodo subscription, so there is no "new-subscription first payment."
- **Idempotency of a retried consolidation request:**
  - Step 4 `changePlan` is guarded by `if (S_A.planFamily === "growth") skip` → a retry does not re-charge.
  - Step 6 cancels are guarded by `if (S_B.status === "canceling") skip`.
  - The `plan_changed` webhook is idempotent (absolute writes).
- A user can only initiate consolidation from a UI that disables the button while `S_A.pendingPlanChange` is set.

### 6.5 Growth checkout/changePlan succeeds but a workspace move fails

Covered by the design above:

1. `changePlan(S_A → Growth)` succeeds at Dodo (step 4).
2. The `$transaction` in step 5 throws (e.g. DB blip while re-pointing W3).
3. **Rollback:** the entire transaction reverts — `S_A`'s row still says `standard`, W2/W3 still point at S_B/S_C. **W1, W2, W3 all remain covered** (W1 by S_A which Dodo now bills as Growth but our row still gates as Standard — a temporary *under*-entitlement, not a gap; W2/W3 by S_B/S_C).
4. **Self-heal:**
   - `S_A.pendingPlanChange` was written **before** `changePlan` (step 3) and is **not** rolled back (it was a separate prior write). It persists.
   - The `subscription.plan_changed` webhook for `S_A` arrives independently → the processor sees `S_A.pendingPlanChange.kind === "consolidate"` → re-runs step 5 (idempotent: sets S_A to Growth, re-points W2/W3, marks S_B/S_C canceling, fans out, clears `pendingPlanChange`).
   - The reconciliation cron (hourly) does the same for any `pendingPlanChange` where the linked Dodo sub already reports the target product.
   - Step 6 cancels are retried from `billing_reconcile_queue`.
5. **No duplicate charge** during recovery: `changePlan` is never re-called (guard: `S_A.planFamily`/product already Growth), no new subscription is created.
6. **Worst realistic residual:** a few minutes where W1 has Growth billing but Standard features (social attribution not yet unlocked). Acceptable; resolved on the next webhook/cron tick. Alert fires if `pendingPlanChange` is unresolved after `effectiveAt + 48h` (I-15).

---

## 7. Growth → Standard downgrade with > 1 workspace (exact)

**Precondition:** Subscription `G` (Growth, `maxWorkspaces=30`), `workspaceCount = N > 1`, covering `W1…WN`. Preserve all data; never delete a website.

```
1. POST /api/subscriptions/[G]/change-plan {
     targetFamily: "standard", targetTier, targetInterval,
     keepWorkspaceId: W_k,
     acknowledgement: { detachWorkspaceIds: [<exactly the current set minus W_k>] }
   }
2. endpoint REJECTS (422) unless:
     - keepWorkspaceId is currently attached to G
     - acknowledgement.detachWorkspaceIds === (workspaces of G) \ {W_k}   (exact set match)
   → forces the UI to show precisely which N-1 sites will pause
3. dodo.subscriptions.changePlan(G.dodoSubscriptionId, {
     product_id: <standard tier product>, quantity: 1,
     proration_billing_mode: "do_not_bill",     // applies at NEXT renewal, no charge now, cycle preserved
   })
4. $transaction (SCHEDULE only — change nothing else yet):
     G.pendingPlanChange = {
       kind: "downgrade",
       effectiveAt: G.currentPeriodEnd,
       toFamily: "standard", toTier: targetTier, toInterval: targetInterval,
       keepWorkspaceId: W_k,
     }
   // G.maxWorkspaces stays 30; ALL W1..WN stay attached; ALL keep Growth entitlement until effectiveAt
5. AT effectiveAt  (driven by subscription.plan_changed / subscription.renewed webhook;
   reconciliation cron applies any pendingPlanChange where kind="downgrade" AND effectiveAt <= now):
     $transaction:
       G.planFamily      = "standard"
       G.maxWorkspaces   = 1
       G.planTier        = targetTier
       G.tierEvents      = <standard tier events>
       G.billingInterval = targetInterval-as-enum
       G.dodoProductId   = <standard product>
       W_k stays attached;  G.workspaceCount = 1
       for each W_i in (W1..WN) \ {W_k}:
           W_i.subscriptionId = null
           W_i.<cache> = INACTIVE_BASELINE          // paused, NOT deleted
       fanOutSubscription(G.id, tx)                  // W_k → Standard entitlement
       fanOutLegacyColumns(G.id, tx)
       G.pendingPlanChange = null
6. paused workspaces (W_i): dashboard redirects to /{slug}/billing; POST /api/track → 403.
   All TrackedEvent / Customer / Payment / CustomerSubscription / funnels / settings / integrations
   / Tinybird data for W_i are UNTOUCHED.
7. recovery options for the user:
     - buy a Standard subscription per paused workspace (each attach → new Subscription)
     - re-changePlan G back to Growth (maxWorkspaces → 30) then re-attach the paused workspaces
       (D12: billing UI offers "re-attach your N previous sites" =
        Workspace WHERE subscriptionId IS NULL AND owner = me)
8. cancel the scheduled downgrade before effectiveAt:
     POST /api/subscriptions/[G]/change-plan with G's CURRENT growth product + do_not_bill,
     then clear G.pendingPlanChange. Nothing was detached yet → clean revert.
```

**Data-preservation guarantee (I-16):** the downgrade path calls `workspace.update` (null the FK + reset cache) **only**. It never calls `workspace.delete`; `Workspace.subscription` is `onDelete: SetNull`, so even deleting `G` could not cascade to workspaces. Tests assert `count(TrackedEvent)`, `count(Customer)`, `count(Payment)` for each `W_i` are identical before and after.

---

## 8. Multiple Growth subscriptions — NOT ALLOWED

**D17 — RESOLVED: a user may have AT MOST ONE non-terminal Growth subscription.**

This **supersedes** the "or a second Growth plan" wording in `docs/billing-architecture-final.md §22 (Scenario 6, row "30/30 used")`. These are **websites/workspaces**, not "seats" — do not use "seat" language in any user-facing copy. When a user's single Growth subscription already covers 30 websites and they want to add another, the **only** options are:

1. **Buy a Standard subscription for the new website**, or
2. **Remove/detach an existing website from the Growth subscription** (its data is preserved — see §7 / I-16), then add the new website.

There is **no** "add a second Growth plan" path, and no code path offers one.

### 8.1 Enforcement

**Database (Migration 1):**
```sql
CREATE UNIQUE INDEX "one_active_growth_per_user"
  ON "Subscription" ("ownerUserId")
  WHERE "planFamily" = 'growth' AND "status" NOT IN ('canceled', 'expired');
```
(A user who fully cancels Growth and later re-subscribes is fine — the old row is `canceled`/`expired` and excluded from the index.)

**Business logic:**
- `createSubscriptionCheckout({ intent: "growth" })` → `409 { code: "growth_subscription_exists" }` if the user already has a `Subscription` with `planFamily="growth"` and `status ∉ {canceled, expired}`. The only Growth actions then permitted are `changePlan` (tier up/down) and `cancel`/`resume` on the existing row.
- `consolidateStandardSubs` always targets the single existing/new Growth subscription.
- `attach` naturally targets a specific `subscriptionId`, so there is never ambiguity about "which Growth."

### 8.2 Rationale

- One Growth = 30 workspaces; needing >30 is a genuine long-tail case.
- Multiple Growth subs create "which one does this workspace attach to?" ambiguity and split the entitlement/seat model.
- The consolidation flow (§6) assumes a single Growth target.

---

## 9. Trial — attached to the Subscription

**CONFIRMED:** the trial is a property of the **`Subscription`** — `Subscription.status = "trialing"` + `Subscription.trialEndsAt` — **not** of the Workspace and **not** purely of the User.

`User.freeTrialUsedAt` is a **lifetime eligibility flag only**: "has this user ever started a trial." It is set once, in the same `Serializable` transaction that creates the user's first trialing subscription, and never cleared.

### 9.1 First Standard subscription created

- `user.freeTrialUsedAt == null` →
  - create `Subscription`: `planFamily="standard"`, `status="trialing"`, `trialEndsAt = now + 14d`, `maxWorkspaces=1`, `workspaceCount=1`.
  - **Cardless** by default: `dodoSubscriptionId = null`, no Dodo checkout yet. (Or, if the user chose to enter a card, checkout with `subscription_data.trial_period_days = 14`; `dodoSubscriptionId` bound on `subscription.active`.)
  - `user.freeTrialUsedAt = now` (same transaction).
  - the 1 attached workspace: `subscriptionStatus="trialing"`, `freeTrialEndDate = trialEndsAt` (fan-out). Full access for 14 days.
- `user.freeTrialUsedAt != null` → **no trial.** Immediate paid checkout; `status="active"` on `subscription.active`.

### 9.2 Second Standard subscription created

- `user.freeTrialUsedAt` is already set (from sub #1) → **no trial, ever, for this subscription.**
- Straight to paid Dodo checkout. `status="active"` on `subscription.active`. Its 1 workspace is covered and **charged immediately**.
- Sub #1's trial is **completely unaffected** — it runs to its own `trialEndsAt` independently.

### 9.3 Growth purchased

| Situation | Trial? |
|---|---|
| Growth is the user's **first ever** subscription, `freeTrialUsedAt == null` | **Yes** — `status="trialing"`, `trialEndsAt = now+14d`, `freeTrialUsedAt = now`. All attached workspaces inherit `freeTrialEndDate`. |
| User **already trialed** (`freeTrialUsedAt` set) — e.g. bought Growth after a Standard sub | **No** — immediate paid checkout; `status="active"` on payment. |
| Growth reached via `changePlan` from a **paid** Standard sub (§5 path 4a) | **No trial involvement** — the Standard sub was `active`; `changePlan` proration charges the delta. |
| Growth reached from a **trialing** Standard sub | Goes through **checkout with `trial_period_days = getRemainingTrialDays()`** (§5 path 4b), **not** `changePlan` (Dodo's `prorated_immediately` would end the trial and charge). The **same `Subscription` row** is reused (`internalSubscriptionId` in metadata); `trialEndsAt` is **preserved**; `freeTrialUsedAt` was already set. No new/extended trial — the remaining days carry over. |

### 9.4 Multiple Standard subscriptions consolidated into Growth (§6)

- Among a user's multiple Standard subs, **at most one** can ever be trialing (I-14). By the time a user has 2+ Standard subs, that trial is almost always already converted or expired (sub #2 onward never got one).
- The **consolidation survivor is always a paid sub** (§6 precondition) → `changePlan(survivor → Growth)` operates on an `active` subscription → normal proration, **no trial interaction**.
- If a **non-survivor** Standard sub is still a cardless trial: it is marked `status="canceled"`, `workspaceCount=0`; its workspace is re-pointed to Growth. **The trial simply ends** (the user is now on paid Growth covering that workspace). No charge, no Dodo call for that trial row. `freeTrialUsedAt` stays set.
- The **Growth subscription does not receive a fresh trial** — `freeTrialUsedAt` is set, so Growth is billed immediately (via the survivor's `changePlan` proration).
- **Net:** consolidation never grants, extends, or restarts a trial; it terminates any lingering trial by moving the user onto paid Growth.

### 9.5 Trial rule, one line

> **One trial per user, lifetime** (`User.freeTrialUsedAt`). It lives on the user's **first** `Subscription`, is **cardless** until converted, and lasts **14 days**. Every subsequent subscription — Standard #2, Growth-after-Standard, consolidation — is **immediately paid, no trial**. Converting the trialing subscription itself (Standard→Growth while trialing) **preserves the remaining days** via Dodo `trial_period_days` and **reuses the same `Subscription` row**.

---

## 10. FINAL INVARIANT SET — implementation & tests MUST enforce

### A. Structure & counting

1. **`planFamily="standard" ⟺ maxWorkspaces=1`** and **`planFamily="growth" ⟺ maxWorkspaces=30`**. (DB CHECK + creation logic.)
2. **A workspace has 0 or 1 subscription** (`subscriptionId` single nullable FK). Null ⇒ uncovered ⇒ dashboard billing-wall + `/api/track` 403.
3. **`count(Workspace WHERE subscriptionId=S) ≤ S.maxWorkspaces`** for every `S`, always. Attaching beyond the cap is rejected atomically (`409`).
4. **`S.workspaceCount === count(Workspace WHERE subscriptionId=S)`** always. Counter is `+1` only in the guarded `attach`; recomputed via `count()` everywhere else.
5. **A user has ≤ 1 non-terminal Growth subscription** (partial unique index + service guard). N Standard + ≤1 Growth may coexist.
6. **`dodoSubscriptionId` is unique**; null only for an unconverted cardless trial.
7. **One Dodo customer per user** (`User.dodoCustomerId @unique`); all of that user's `Subscription.dodoCustomerId` match it (post-migration).

### B. Entitlement / cache coherence

8. **Single writer:** `Workspace.{subscriptionStatus, planFamily, planTier, tierEvents, usageLimit, currentPeriodEnd, freeTrialEndDate, paymentFailedAt}` are written **only** by `fanOutSubscription`, `attach`, `detach`. No route handler, action, or unrelated cron writes them.
9. **Covered workspace cache == parent-derived values.** Uncovered workspace cache == `INACTIVE_BASELINE`.
10. **`usageLimit == tierEvents` of the parent subscription** (D1: per-website limit). `t10m_plus ⇒ usageLimit = MAX_SAFE_INTEGER`.
11. **`isEntitled(workspace)` is the sole access predicate** — `true` for `active`, valid `trialing`, `past_due` within grace (§3). Used identically by `hasWorkspaceAccess`, `apps/ingestion/track.ts`, `track-ai-bot.ts`, `workspaceHasSocialAttribution`, and social cron eligibility.

### C. Dodo / payment safety

12. **Adding a website under Growth makes ZERO `dodo.*` calls**, creates no `Subscription` row, no payment. (`attach` path.)
13. **`changePlan` is never called twice for the same transition** — guarded by the target `planFamily`/`planTier`/product already matching.
14. **No billing flow creates a *new* Dodo subscription when an existing one can be `changePlan`'d** (single-survivor Standard→Growth uses `changePlan`, not checkout+cancel).
15. **`cancel_at_next_billing_date` is the cancellation primitive** for consolidation and user-initiated cancel-at-period-end; it issues no charge and no refund.
16. **Standard→Growth from a *paid* sub → `prorated_immediately`.** **Any downgrade (tier-down, Growth→Standard) → `do_not_bill`** (effective next renewal). **Equal-price Growth-yearly 100K↔200K → `do_not_bill`.**
17. **Trialing subscription → Growth uses checkout(`trial_period_days`), never `changePlan`.**

### D. Webhook / consistency

18. **Webhook processing is idempotent** — dedup by `webhook-id` (`DodoWebhookEvent`), all `Subscription` writes absolute, `workspaceCount` recomputed not incremented, fan-out is one `updateMany`, side effects gated on `welcomeEmailSentAt`.
19. **Out-of-order protection** — an event with `timestamp < Subscription.lastEventAt` is discarded.
20. **Webhook processing is transactional** — `Subscription` update + fan-out + `markDone` in one `$transaction`; failure rolls back all three and returns 5xx for Dodo retry.
21. **No fire-and-forget** — the webhook awaits processing before responding.
22. **`pendingPlanChange` is eventually applied or cleared** (webhook when `effectiveAt<=now`, else reconciliation cron); unresolved past `effectiveAt + 48h` → alert.
23. **Reconciliation cron (hourly) re-derives every non-terminal `Subscription` from `dodo.subscriptions.retrieve()`** and repairs any drift in status, product, periods, `workspaceCount`, `pendingPlanChange`, and workspace cache.

### E. Data preservation

24. **No billing operation deletes workspace data.** Downgrade / cancel / expiry / consolidation / detach only null `Workspace.subscriptionId` and reset the cache. `Workspace.subscription` FK is `onDelete: SetNull`. Row counts for `TrackedEvent`, `Customer`, `Payment`, `CustomerSubscription`, `Funnel` are invariant across every such operation.
25. **Growth→Standard with N>1 workspaces is a gated, scheduled operation** — endpoint rejects (422) without an exact `keepWorkspaceId` + `detachWorkspaceIds` acknowledgement; nothing detaches until `effectiveAt`.

### F. Trial

26. **Exactly one trial per user, lifetime** (`User.freeTrialUsedAt`, set in a `Serializable` tx with the first trialing subscription).
27. **The trial belongs to the user's first `Subscription`** (`status="trialing"`, `trialEndsAt`), cardless until converted, 14 days.
28. **Every subscription after the first is immediately paid, no trial** — `createSubscriptionCheckout` passes `trial_period_days` only when `freeTrialUsedAt == null`.
29. **Trial expiry is subscription-scoped** — all workspaces attached to a trialing subscription flip to `inactive` together (webhook / reconciliation, never per-request in `withWorkspace`).

### G. "Add Website" choice

30. **`POST /api/subscriptions` accepts `intent:"standard"` unconditionally.** No server path returns "you must upgrade to Growth." A Standard user adding site #2 is always shown both: new Standard subscription **or** Growth.
31. **When a Growth subscription already covers 30 websites and the user adds another**, the offered options are (1) **buy a Standard subscription for the new website**, or (2) **remove/detach an existing website from the Growth subscription** (data preserved) then add the new one — **never** a second Growth subscription (I-12 / §8). No "seat" wording in user-facing copy.

---

## 11. Remaining assumptions to verify during implementation (non-blocking)

| # | Assumption |
|---|---|
| A2 | Dodo Checkout Sessions accept an existing `customer_id` to attach (docs confirm "Attach Existing Customer"; confirm the exact SDK field against the `dodopayments` package types). |
| A3 | `subscription.plan_changed` fires when a `do_not_bill` change **takes effect** (at renewal), not only at request time. If Dodo only emits it at request time, the reconciliation cron's `pendingPlanChange.effectiveAt` check is the enforcer (already planned). |
| A4 | Dodo permits `changePlan` between arbitrary products (Standard product ↔ Growth product) with no product-family restriction in the account config. |
| A5 | `dodo.subscriptions.update({ cancel_at_next_billing_date: true })` is the correct "cancel at period end" call (vs a dedicated method). |
| A9 | Dodo's **Subscription Dunning** retry window for failed renewals is ≤ 7 days on the account config (so the §3 grace cap doesn't revoke access mid-dunning). If longer, the state-driven half of the §3 rule ("while Dodo sub non-terminal") already covers it — but align the numeric backstop. |
| A1 | Old `WorkspacePlan` enum → new `planTier` backfill map (esp. old `basic` 25k → new `t100k` round-up; old `enterprise`/`ultimate` → `t10m_plus`). Sign-off before the backfill runs. |
| D14 | `Invoice.workspace onDelete` — `Cascade` vs `SetNull` (accounting decision). If unresolved at Deploy 1, split into a later standalone migration; does not block billing work. |

**All of D6, D10, D13, D17 are now resolved above.** D14 is the only remaining *decision* and it is non-blocking (defer-able). A1–A9 are implementation-time verifications, not product decisions.

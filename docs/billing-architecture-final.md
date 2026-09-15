# Convrs Billing Architecture — Final Validation (for approval)

**Date:** 2026-09-07
**Status:** Design for sign-off. **No code changed.** Implementation begins only after approval.
**Companion doc:** `docs/billing-architecture-audit.md` (why the current model can't support the target).

Model under validation:

```
User ──< Subscription ──< Workspace
             │
   Standard: covers exactly 1 Workspace   (maxWorkspaces = 1)
   Growth:   covers up to 30 Workspaces   (maxWorkspaces = 30)

Dodo customer  → belongs to User
Dodo subscription → 1:1 with our Subscription row
Workspace → keeps a denormalized entitlement cache for hot paths
```

All 10 scenarios validate against this model. Details below, then the 13 deliverables.

---

## Scenario validation

### Scenario 1 — One Standard website ✅

```
User (dodoCustomerId = cus_1)
└── Subscription A  { family: standard, maxWorkspaces: 1, workspaceCount: 1, dodoSubscriptionId: sub_A }
    └── Workspace 1 { subscriptionId: A }
```

Nothing special. `Workspace 1` denormalized cache = A's plan/status/limits.

### Scenario 2 — Two Standard websites ✅

```
User (dodoCustomerId = cus_1)
├── Subscription A { standard, max 1, count 1, dodoSubscriptionId: sub_A }
│   └── Workspace 1
└── Subscription B { standard, max 1, count 1, dodoSubscriptionId: sub_B }
    └── Workspace 2
```

- Two **separate Dodo subscriptions** (`sub_A`, `sub_B`), **one Dodo customer** (`cus_1`).
- This is exactly what the current model **cannot** do — `Workspace.dodoCustomerId @unique` allows `cus_1` on only one workspace row. Moving `dodoCustomerId` to `User` fixes it.
- Dodo Customer Portal for `cus_1` lists **both** subscriptions in one view (confirmed in Dodo docs: portal "displays all active subscriptions"). "Manage billing" works from either workspace.

### Scenario 3 — Standard → Growth (user has ONE Standard sub)

**Recommendation: mutate Subscription A in place via Dodo `changePlan`. Do NOT create a new subscription; do NOT cancel anything.**

```
BEFORE                         AFTER (same row, same dodoSubscriptionId)
Subscription A                 Subscription A
{ standard, max 1, sub_A }     { growth, max 30, sub_A }
└── Workspace 1                ├── Workspace 1
                              ├── Workspace 2  (added later)
                              └── ... up to Workspace 30
```

**What happens to the old Standard subscription:** it *becomes* the Growth subscription. Same Dodo `subscription_id` (`sub_A`), same internal `Subscription` row (`A`), same `dodoCustomerId`, same payment method, same invoice history. Only the `product_id` changes (Standard tier product → Growth tier product), and our `planFamily` / `maxWorkspaces` / `tierEvents`.

**API call:**
```ts
await dodo.subscriptions.changePlan(sub_A, {
  product_id: <growth tier product id>,
  quantity: 1,
  proration_billing_mode: "prorated_immediately",  // pay only the delta for remaining days
});
```

**Why in-place, not new-sub-plus-cancel:**

| | In-place `changePlan` (recommended) | New Growth sub + cancel Standard |
|---|---|---|
| Dodo API calls | 1 | 2 (+ webhook race) |
| Coverage gap risk | none — same sub stays active throughout | window between new-sub-active and old-sub-cancel |
| Proration / refund edge cases | Dodo handles the delta | must handle prepaid-time loss or manual credit |
| Our `Subscription` row identity | stable → all `Workspace.subscriptionId` FKs untouched | must re-point Workspace 1 to the new row |
| Invoice / payment-method continuity | preserved | new subscription, fresh history |
| Webhook we receive | `subscription.plan_changed` for a `subscription_id` we already know | brand-new `subscription.active` we must match by metadata |
| Dodo's own guidance | "migrate users to a new product… without cancelling their subscription" | — |

The only property `changePlan` resets is the billing cycle (to today) — acceptable, and `prorated_immediately` makes the customer pay only the fair difference.

**Flow:**
1. `POST /api/subscriptions/[A]/change-plan { family: "growth", tier, interval }` — server validates A is the caller's, is `active`/`trialing`, family transition standard→growth is allowed.
2. `dodo.subscriptions.changePlan(sub_A, …)` — **if this throws, abort; nothing in our DB changed.**
3. On success, optimistic local write (transaction): `A.planFamily = growth`, `A.maxWorkspaces = 30`, `A.planTier`, `A.tierEvents`, `A.dodoProductId`. Fan out to Workspace 1 (now `planFamily = growth` → X/Reddit attribution unlocks).
4. Webhook `subscription.plan_changed` / `subscription.updated` for `sub_A` arrives → idempotent re-apply (Scenario 10) confirms the same end state.
5. User can now add Workspaces 2…30 (Scenario 5).

### Scenario 4 — Multiple Standard subscriptions → Growth

You cannot merge Dodo subscriptions. End state needs **one** Growth Dodo subscription.

```
BEFORE                          AFTER
Subscription A → Workspace 1     Subscription A  { growth, max 30, count 3, sub_A }
Subscription B → Workspace 2     ├── Workspace 1
Subscription C → Workspace 3     ├── Workspace 2   (re-pointed from B)
                                └── Workspace 3   (re-pointed from C)
                                Subscription B  { status: canceling → canceled, count 0 }
                                Subscription C  { status: canceling → canceled, count 0 }
```

**Pick a survivor** = the Standard sub with the **furthest `currentPeriodEnd`** (most prepaid value to preserve). Call it A. `changePlan(sub_A → Growth)` as in Scenario 3.

**The other Standard subs (B, C):**
- **Re-point their workspaces to A first**, in the same transaction that flips A to Growth. Workspaces 2 and 3 are now covered by Growth → **no coverage gap even before B/C are touched.**
- **Cancel B and C at next billing date** (`cancel_at_next_billing_date`, not "cancel now"):
  - Customer keeps whatever they prepaid on B/C (no lost value, no clawback).
  - Brief harmless overlap: they pay Growth now **and** B/C run out their already-paid tail. No new charge for B/C (they simply don't renew).
  - When B/C expire, the `subscription.cancelled`/`expired` webhook sees their workspaces already on A → no-op.
- ("Cancel now + prorated credit" is worse here: the credit is *subscription-scoped* to B/C, which are going away, so it's effectively lost. If the business wants instant cleanup, cancel-now **plus a manual goodwill coupon on A** — Decision D2.)

**Exact order (failure-safe):**
1. Validate `A.count + B.count + C.count ≤ 30`.
2. `dodo.subscriptions.changePlan(sub_A → growth)` — abort on failure, nothing changed.
3. **One transaction:**
   - `A`: `planFamily = growth`, `maxWorkspaces = 30`, tier fields.
   - `Workspace 2, 3`: `subscriptionId = A`.
   - `A.workspaceCount = count(Workspace where subscriptionId = A)` (recompute, don't increment).
   - `B, C`: `status = canceling`, `workspaceCount = 0`.
   - Fan out A → Workspaces 1, 2, 3.
4. `dodo.subscriptions.cancel(sub_B, at_period_end)`, `dodo.subscriptions.cancel(sub_C, at_period_end)` — failure here = user briefly double-billed, **not** a coverage or data problem; alert + retry via reconciliation cron.
5. Webhooks (`plan_changed` A, `cancelled` B/C) arrive later → idempotent confirm.

Failure direction is always "user has *more* access than they're strictly paying for," never less, and never data loss.

### Scenario 5 — Growth adding websites (up to 30, block 31) ✅

Pure Convrs-side. **No Dodo call, no payment, no new `Subscription` row.**

`POST /api/workspaces/[W3]/billing/attach { subscriptionId: G }`:
```ts
// Atomic seat claim — guarded UPDATE, not read-then-write:
const claimed = await prisma.subscription.updateMany({
  where: { id: G, ownerUserId: me, status: { in: ["active", "trialing"] },
           workspaceCount: { lt: prisma.subscription.fields.maxWorkspaces } }, // see D-impl note
  data:  { workspaceCount: { increment: 1 } },
});
if (claimed.count === 0) return 409 "Growth plan is full (30/30) or not active";

await prisma.workspace.update({
  where: { id: W3 },
  data: { subscriptionId: G, /* + denormalized fan-out fields from G */ },
});
```
- Website 31: the guarded `updateMany` matches 0 rows → `409`. UI: *"Your Growth plan covers 30 websites and all 30 are in use. Buy a Standard subscription for this website, or remove an existing website from your Growth plan first."* **There is no "second Growth plan" option** — one Growth subscription per user (see `docs/billing-invariants.md §8`). Do not use "seat" in user-facing copy — these are websites/workspaces.
- Detaching a website (delete or manual): `subscriptionId = null`, recompute `workspaceCount`, reset that workspace's cache to inactive/free. **Growth price does not change** with the number of attached websites. The detached website's data is preserved (I-16).

(Impl note: Prisma can't compare two columns in `where` directly; use a raw `UPDATE … WHERE workspace_count < max_workspaces` or a `$transaction` with `SELECT … FOR UPDATE`. Both fine.)

### Scenario 6 — Standard user adds Website #2 (MUST offer a choice, never force Growth) ✅

The rule *"a Standard user must upgrade to Growth to create site #2"* is **structurally impossible** in this design, because `POST /api/subscriptions` accepts `intent: "standard"` unconditionally and the UI always renders both cards.

**Flow:**
1. `POST /api/workspaces` → creates Workspace 2 `inactive`, `subscriptionId = null` (same as today — cheap, lets the user finish naming/domain).
2. Client calls **`GET /api/billing/context`** (new, **user-scoped**):
   ```jsonc
   {
     "standardSubs":  [ { "id": "A", "tier": "10k", "status": "active" } ],
     "growthSub":     null,               // or { id, workspaceCount, maxWorkspaces }
     "growthHasFreeSeat": false,
     "trialAvailable": false               // user.freeTrialUsedAt == null
   }
   ```
3. Billing step renders — **always both, when the user is not already on Growth:**

   | Card | CTA | Endpoint |
   |---|---|---|
   | **Standard** — "$X/mo · this website only" | Buy Standard | `POST /api/subscriptions { intent:"standard", tier, interval, targetWorkspaceId: W2 }` → Dodo checkout URL |
   | **Growth** — "$Y/mo · up to 30 websites" | Switch to Growth | `POST /api/subscriptions { intent:"growth", tier, interval, targetWorkspaceId: W2, consolidateStandardSubIds:["A"] }` → checkout **or** `changePlan` (Scenario 3/4) |
   | *(only if `growthHasFreeSeat`)* **Add to your Growth plan (N/30)** | Add — free | `POST /api/workspaces/[W2]/billing/attach { subscriptionId: G }` |

4. The **`intent`** field is the whole distinction:
   - `intent: "standard"` → new Dodo subscription against a **Standard** `product_id`, our `Subscription` row with `maxWorkspaces = 1`, bound to exactly `targetWorkspaceId`.
   - `intent: "growth"` → Dodo subscription against a **Growth** `product_id`, `maxWorkspaces = 30`, optional consolidation of existing Standard subs.
5. The server **never** returns a response that offers only Growth. There is no code path that rejects "add website" and demands an upgrade.

### Scenario 7 — Growth downgrade to Standard with 10 websites (preserve all data) ✅

**Never deletes anything.** `Workspace.subscription` is `onDelete: SetNull` — even deleting the `Subscription` row would not touch workspaces, their tracked events, customers, or Tinybird data.

**Gated flow:**
1. Downgrade UI **blocks** with a required choice:
   > *"Standard covers 1 website. You have 10. Choose the 1 website to keep active. The other 9 will be set to **Unbilled** at your next renewal — all their data is kept, but tracking pauses and their dashboards lock until you add a subscription for each (or switch back to Growth)."*
2. On confirm, store a **scheduled** change (do not apply now):
   ```
   Subscription G.pendingPlanChange = {
     effectiveAt: G.currentPeriodEnd,
     targetFamily: "standard",
     targetTier, targetInterval,
     keepWorkspaceId: W_chosen
   }
   ```
   and call `dodo.subscriptions.changePlan(sub_G, { product_id: <standard tier>, proration_billing_mode: "do_not_bill" })` — `do_not_bill` = switch at renewal, **no charge now, billing date preserved**. The customer keeps Growth + all 10 sites for the period they already paid for.
3. **At `effectiveAt`** (driven by the `subscription.renewed` / `subscription.plan_changed` webhook, with the reconciliation cron as backstop):
   - `G.planFamily = standard`, `G.maxWorkspaces = 1`, tier fields updated.
   - `W_chosen` stays attached; `G.workspaceCount = 1`.
   - The other 9: `subscriptionId = null`, denormalized cache → `subscriptionStatus = inactive`, `planFamily = standard`, `usageLimit = 0`. Fan out.
   - Clear `G.pendingPlanChange`.
4. The 9 workspaces now show the billing wall. Each can buy its own Standard sub, **or** the user re-upgrades G to Growth and **re-attaches** them (Scenario 5 — attach is just setting `subscriptionId` again; the workspaces were never modified).

**Data preservation guarantee:** the downgrade path calls `workspace.update` (to null the FK + reset cache) only — never `workspace.delete` or any cascade. Verified against the model: no `onDelete: Cascade` fires because the FK is set to null, not the row deleted.

### Scenario 8 — Dodo customer on `User` ✅

- `User.dodoCustomerId` is set **once**, either:
  - pre-created via Dodo API before the first checkout, or
  - captured from the first `subscription.active` webhook.
- Every subsequent checkout passes the existing `customer_id` (Dodo Checkout Sessions support **"Attach Existing Customer"** — confirmed in docs). So **all** of a user's subscriptions — N Standard + 1 Growth — roll up to one Dodo customer.

| Situation | Behaviour |
|---|---|
| Multiple Standard subs | N `Subscription` rows, N `dodoSubscriptionId`s, all `dodoCustomerId = user.dodoCustomerId`. |
| One Growth sub | Same customer, one more `Subscription` row. |
| Upgrade / cancel | `changePlan` / `cancel` act on `dodoSubscriptionId`; customer untouched. |
| Multiple workspaces | Workspaces never carry a Dodo id at all — only `subscriptionId`. |
| Customer Portal | `dodo.customers.customerPortal.create(user.dodoCustomerId)` → one portal listing **all** the user's subscriptions + payment methods + invoices. |
| Invoices / payment methods API | Query by `user.dodoCustomerId`. |

**Dodo `subscription_id` → internal `Subscription` mapping:**

- Join key: `Subscription.dodoSubscriptionId @unique`.
- **Create the internal `Subscription` row first** (in `POST /api/subscriptions`, `status = inactive`, `dodoSubscriptionId = null`), then pass its id as `metadata.internalSubscriptionId` into the Dodo checkout session.
- `subscription.active` webhook → `Subscription.update({ where: { id: metadata.internalSubscriptionId }, data: { dodoSubscriptionId: data.subscription_id, … } })`. Fallback: upsert by `dodoSubscriptionId` if metadata is missing.
- All later events (`updated`, `renewed`, `plan_changed`, `on_hold`, `cancelled`, `expired`) → `Subscription.findUnique({ where: { dodoSubscriptionId: data.subscription_id } })`.
- Cardless trial: `Subscription` row exists with `dodoSubscriptionId = null`; conversion checkout carries `internalSubscriptionId`; webhook back-fills the Dodo id.

This removes every "which subscription is this webhook about" ambiguity.

### Scenario 9 — Workspace access via denormalized fields ✅

**Invariant: exactly one writer.** The denormalized fields on `Workspace` (`subscriptionStatus`, `planFamily`, `planTier`, `tierEvents`, `usageLimit`, `currentPeriodEnd`, `freeTrialEndDate`, `paymentFailedAt`) are written **only** by:
1. the webhook fan-out, and
2. the `attach` / `detach` endpoints (which set them from the parent `Subscription` or to the inactive baseline).

Nothing else — no route handler, no user action, no cron except reconciliation — touches them. `usage` (the real counter) is never touched by fan-out.

**Read paths stay join-free:**
- `apps/ingestion/src/controllers/track.ts` — reads `workspace.subscriptionStatus`, `workspace.usageLimit` per event. Unchanged.
- `[slug]/layout.tsx` → `hasWorkspaceAccess` — reads `workspace.subscriptionStatus`, `workspace.freeTrialEndDate`. Unchanged.
- `entitlement.ts::workspaceHasSocialAttribution` — reads `workspace.planFamily` (+ now also require `subscriptionStatus ∈ {active,trialing}`). Unchanged shape.
- Social cron `social-eligibility.ts` — `where: { planFamily: "growth" }` on `Workspace`. Unchanged.

**How a webhook updates `Subscription` + all attached `Workspace`s:**

```ts
async function applyAndFanOut(dodoSubId, patch, eventTimestamp, tx) {
  const sub = await tx.subscription.findUnique({ where: { dodoSubscriptionId: dodoSubId } });
  if (!sub) return;                                    // pre-active race: skip, active will handle
  if (sub.lastEventAt && eventTimestamp < sub.lastEventAt) return;  // stale/out-of-order guard

  const updated = await tx.subscription.update({
    where: { id: sub.id },
    data: { ...patch, lastEventAt: eventTimestamp },
  });

  // ONE SQL UPDATE regardless of 1 or 30 workspaces → atomic, no partial fan-out
  await tx.workspace.updateMany({
    where: { subscriptionId: sub.id },
    data: {
      subscriptionStatus: updated.status,
      planFamily:         updated.planFamily,
      planTier:           updated.planTier,
      tierEvents:         updated.tierEvents,
      usageLimit:         updated.tierEvents,          // per-site limit (Decision D1)
      currentPeriodEnd:   updated.currentPeriodEnd,
      freeTrialEndDate:   updated.trialEndsAt,
      paymentFailedAt:    updated.paymentFailedAt,
    },
  });
}
```

- Whole thing runs inside **one `prisma.$transaction`**. Failure → full rollback → webhook returns non-2xx → Dodo retries.
- `updateMany` is a single statement — there is no "27 of 30 updated" state.
- Detach path additionally sets the leaving workspace's cache to the inactive baseline in the same transaction.
- `Subscription.lastEventAt` monotonic guard handles Dodo's documented out-of-order delivery (Dodo also always sends "the latest payload at time of delivery," so a late retry still carries current data).
- **Reconciliation cron** (hourly): for each `Subscription` with a `dodoSubscriptionId`, `dodo.subscriptions.retrieve()` and re-run `applyAndFanOut` on any drift. Catches fully-missed webhooks.

### Scenario 10 — Webhook idempotency (must land before fan-out) ✅

Dodo: up to **8 retries** (exponential backoff to ~28h), **15-second** response window, events **may arrive out of order**, "you will receive the same event multiple times."

**Strategy — four layers:**

**Layer 1 — dedup table (`DodoWebhookEvent`), PK = `webhook-id` header:**
```ts
// after signature verification (client.webhooks.unwrap) succeeds:
const inserted = await prisma.dodoWebhookEvent.createMany({
  data: [{ webhookId, eventType, dodoSubscriptionId, status: "processing" }],
  skipDuplicates: true,
});
if (inserted.count === 0) {
  const existing = await prisma.dodoWebhookEvent.findUnique({ where: { webhookId } });
  if (existing.status === "done")   return 200;                 // already handled
  if (existing.status === "processing" && age(existing) < 15_000) return 200; // in flight
  // else: prior attempt died mid-way — fall through and re-process (safe, see Layer 3)
}
```

**Layer 2 — process inside one transaction, flip to `done` in the same transaction:**
```ts
await prisma.$transaction(async (tx) => {
  await applyAndFanOut(dodoSubId, patch, eventTimestamp, tx);
  await tx.dodoWebhookEvent.update({ where: { webhookId }, data: { status: "done", processedAt: new Date() } });
});
```
If anything throws, the `status: "done"` write rolls back too → the row stays `processing`/`failed` → a retry re-runs cleanly.

**Layer 3 — every operation is idempotent even without the guard:**
- `Subscription` writes are **absolute** (`status = "active"`, `tierEvents = 100000`), never increments → re-applying is a no-op.
- Fan-out is `updateMany` to absolute values → idempotent.
- Workspace re-pointing: `updateMany where subscriptionId <> G set subscriptionId = G` → idempotent.
- `workspaceCount` is **recomputed** (`count(...)`), never `increment`, inside the webhook → double delivery can't double-count. (The `attach` *endpoint* uses a guarded increment; the *webhook* recomputes.)
- Side effects that a duplicate would visibly repeat (welcome email, onboarding-complete) are gated on their **own** flag (`Subscription.welcomeEmailSentAt`), not just the dedup row.

**Layer 4 — respond fast:** verify signature → dedup insert → run the transaction (one `updateMany` + a few row writes — milliseconds) → `200`. Drop the current fire-and-forget `processWebhookAsync(...).catch(...)`. If fan-out ever grows heavy, move Layer 2 onto QStash keyed by `webhook-id` (QStash adds its own dedup + retry) — not needed at 30 workspaces.

Keep `DodoWebhookEvent` rows ~90 days for audit (mirrors Dodo's own `webhook_events` example), then prune.

---

## Final deliverables

### 1. Final Prisma / data model

```prisma
// ─────────── schema.prisma ───────────
model User {
  // ... existing ...
  dodoCustomerId  String?        @unique      // MOVED from Workspace
  freeTrialUsedAt DateTime?                    // KEEP — one lifetime cardless trial per user
  subscriptions   Subscription[]
}

// ─────────── workspace.prisma (enums already exist: SubscriptionStatus, BillingInterval, PricingFamily) ───────────

model Subscription {
  id                 String   @id @default(cuid())

  ownerUserId        String
  owner              User     @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)

  // Dodo linkage
  dodoSubscriptionId String?  @unique          // null only during a cardless local trial
  dodoCustomerId     String?                    // mirror of owner.dodoCustomerId
  dodoProductId      String?                    // current product_id (encodes tier+interval+family)

  // Plan snapshot — SOURCE OF TRUTH (mirrored onto workspaces)
  planFamily         PricingFamily              // standard | growth
  planTier           String                     // "10k" | "100k" | ... | "10m_plus"  (Decision D3)
  tierEvents         Int
  billingInterval    BillingInterval?           // month | year
  currency           String   @default("USD")

  status             SubscriptionStatus @default(inactive)

  // Coverage
  maxWorkspaces      Int                         // snapshot: 1 (standard) | 30 (growth)  (Decision D11)
  workspaceCount     Int      @default(0)        // maintained with attach/detach; recomputed by webhooks

  // Periods / trial / scheduled change
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  trialEndsAt        DateTime?
  cancelAtPeriodEnd  Boolean  @default(false)
  paymentFailedAt    DateTime?
  pendingPlanChange  Json?                       // { effectiveAt, targetFamily, targetTier, targetInterval, keepWorkspaceId? }

  // Sync guards / side-effect flags
  lastEventAt        DateTime?
  lastWebhookId      String?
  welcomeEmailSentAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspaces Workspace[]

  @@index([ownerUserId])
  @@index([status])
  @@index([dodoSubscriptionId])
}

model Workspace {
  // ... existing non-billing fields ...

  subscriptionId String?
  subscription   Subscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)

  // DENORMALIZED entitlement cache — written ONLY by webhook fan-out + attach/detach
  subscriptionStatus SubscriptionStatus @default(inactive)   // KEEP
  planFamily         PricingFamily      @default(standard)   // KEEP
  planTier           String?                                  // replaces `plan` enum usage (Decision D3)
  tierEvents         Int      @default(0)                     // KEEP
  usageLimit         Int      @default(0)                     // KEEP
  currentPeriodEnd   DateTime?                                 // KEEP
  freeTrialEndDate   DateTime?                                 // KEEP (mirrors Subscription.trialEndsAt)
  paymentFailedAt    DateTime?                                 // KEEP

  usage Int @default(0)   // REAL, per-workspace, never touched by fan-out

  // REMOVE after one transition release (keep nullable meanwhile):
  //   dodoCustomerId       String? @unique   +  @@index([dodoCustomerId])
  //   dodoSubscriptionId   String? @unique   +  @@index([dodoSubscriptionId])
  //   billingInterval  → moves to Subscription
  //   plan (WorkspacePlan enum)  → superseded by planTier string  (Decision D3)
}

model DodoWebhookEvent {
  webhookId          String   @id            // "webhook-id" header
  eventType          String
  dodoSubscriptionId String?
  status             String   @default("processing")  // processing | done | failed
  attempts           Int      @default(0)
  error              String?
  receivedAt         DateTime @default(now())
  processedAt        DateTime?

  @@index([dodoSubscriptionId])
  @@index([status])
}
```

Also fix, in the same migration bundle (pre-existing bugs from `docs/engineering-audit.md` that this work touches):
- `Invoice.workspace` → add `onDelete: Cascade` (or `SetNull`) — Decision D14.
- `apps/web/lib/zod/schemas/workspaces.ts` — drop phantom `stripeId` / `stripeCustomerId` / `stripeSubscriptionId` / `billingCycleStart` / `planTier(number)`; add `subscriptionId` + a nested `subscription` summary object.

### 2. Relationship diagram

```
                    ┌──────────────────────────┐
                    │           User           │
                    │  dodoCustomerId (unique)  │
                    │  freeTrialUsedAt          │
                    └────────────┬─────────────┘
                                 │ 1
                                 │
                                 │ N
                    ┌────────────▼─────────────────────────────┐
                    │              Subscription                 │
                    │  dodoSubscriptionId (unique, nullable)     │
                    │  planFamily: standard | growth             │
                    │  planTier, tierEvents, billingInterval     │
                    │  status                                    │
                    │  maxWorkspaces: 1 (standard) | 30 (growth) │
                    │  workspaceCount                            │
                    │  currentPeriodEnd, trialEndsAt             │
                    │  pendingPlanChange (scheduled downgrade)   │
                    │  lastEventAt (out-of-order guard)          │
                    └────────────┬─────────────────────────────┘
                                 │ 1
                                 │
                                 │ 0..maxWorkspaces
                    ┌────────────▼─────────────────────────────┐
                    │               Workspace                   │
                    │  subscriptionId (FK, nullable, SetNull)    │
                    │  ── denormalized cache (fan-out writes) ── │
                    │  subscriptionStatus, planFamily, planTier  │
                    │  tierEvents, usageLimit, currentPeriodEnd  │
                    │  freeTrialEndDate, paymentFailedAt         │
                    │  ── real ──                                │
                    │  usage                                     │
                    └───────────────────────────────────────────┘

   DodoWebhookEvent (webhookId PK)  ── idempotency / audit, no FK

   Dodo side:   1 Dodo customer  ──<  N Dodo subscriptions
                cus_x            ──<  sub_a (Standard) , sub_g (Growth) , ...
                each Dodo sub  ⇄  exactly one internal Subscription (dodoSubscriptionId)
```

Rules encoded:
- `Standard`: `maxWorkspaces = 1`, so `count(Workspace) ≤ 1`.
- `Growth`: `maxWorkspaces = 30`, so `count(Workspace) ≤ 30`.
- A `Workspace` with `subscriptionId = null` is uncovered → billing wall + ingestion rejected.
- Coverage validity = parent `Subscription.status ∈ {active, trialing}` (+ `past_due` grace, Decision D6).

### 3. Standard subscription lifecycle

| # | Trigger | Dodo | Our `Subscription` | Workspaces (fan-out) |
|---|---|---|---|---|
| 1 | `POST /api/subscriptions {intent:standard, tier, interval, targetWorkspaceId}` | create Checkout Session (attach `customer_id` if known; `metadata.internalSubscriptionId`, `metadata.targetWorkspaceId`) | create row: `status=inactive`, `maxWorkspaces=1`, `dodoSubscriptionId=null` | — |
| 2 | user completes checkout | `subscription.active` webhook | bind `dodoSubscriptionId`; `status=active` (or `trialing`); resolve `planTier/tierEvents/interval` from `product_id`; set periods; `workspaceCount=1` | attach `targetWorkspace` (`subscriptionId=Sub`), fan out; send welcome email once (`welcomeEmailSentAt`) |
| 3 | monthly/yearly | `subscription.renewed` | update periods; clear `paymentFailedAt` | fan out; **reset `usage=0`** (Decision D8) |
| 4 | `POST /api/subscriptions/[id]/change-plan` (tier up/down, same family) | `changePlan(prorated_immediately` up `/ do_not_bill` down`)` | on `plan_changed` webhook: update tier/limits | fan out new `usageLimit` |
| 5 | payment fails | `subscription.on_hold` → `past_due` | `status=past_due`, `paymentFailedAt=now` | fan out; Dodo runs dunning; recovery → `subscription.active` → clear |
| 6 | user cancels | `POST /api/subscriptions/[id]/cancel` → `cancel(at_period_end)` | on `subscription.cancelled`: `status=canceling`, `cancelAtPeriodEnd=true` | no change — workspace keeps access until `currentPeriodEnd` |
| 7 | period lapses | `subscription.expired` (or cron at `currentPeriodEnd`) | `status=canceled`, `workspaceCount=0` | detach workspace: `subscriptionId=null`, cache → inactive/free; fan out. **Data retained.** |
| 8 | only workspace deleted | — | `workspaceCount=0`; schedule `cancel(at_period_end)` (Decision D5) | n/a |
| 9 | Standard → Growth | Scenario 3 | in-place `changePlan`; `planFamily=growth`, `maxWorkspaces=30` | fan out — social attribution unlocks |

### 4. Growth subscription lifecycle

| # | Trigger | Dodo | Our `Subscription` | Workspaces |
|---|---|---|---|---|
| 1 | `POST /api/subscriptions {intent:growth, tier, interval, targetWorkspaceId?, consolidateStandardSubIds?}` | Checkout Session **or** `changePlan` on an existing single Standard sub (Scenario 3) | create/reuse row: `maxWorkspaces=30` | — |
| 2 | activation | `subscription.active` / `plan_changed` | bind, `status`, tier, periods | attach target workspace(s); **consolidate** — re-point workspaces from the user's Standard subs, cancel those Standard subs `at_period_end` (Scenario 4); `workspaceCount=count(...)`; fan out `planFamily=growth` → **X/Reddit attribution unlocks for all** |
| 3 | add website | **none** | `POST /api/workspaces/[id]/billing/attach` — guarded `workspaceCount` increment `< 30` | attach + fan out from Growth sub. No payment, no new row. |
| 4 | remove website (delete/detach) | **none** | recompute `workspaceCount` | leaving workspace → cache reset to inactive; Growth price unchanged |
| 5 | renewal / tier change / payment fail | as Standard | as Standard | fan-out `updateMany` hits **all N** in one statement |
| 6 | adding a website when 30 are already covered | — | guarded update matches 0 rows | `409` — UI offers: buy Standard for the new website, **or** remove an existing website from Growth first. **Never** a 2nd Growth subscription. |
| 7 | downgrade to Standard | Scenario 7 — **gated + scheduled** (`pendingPlanChange`, `do_not_bill`) | applied at `currentPeriodEnd` | keep 1 chosen; detach the rest → inactive. **All data preserved.** |
| 8 | user cancels | `cancel(at_period_end)` | `status=canceling` | **all N** keep access until `currentPeriodEnd`; UI must list every affected site before confirm |
| 9 | period lapses | `subscription.expired` | `status=canceled`, `workspaceCount=0` | **all N** detached → inactive. Data retained; user can re-subscribe + re-attach. |

### 5. Standard → Growth migration flow (single Standard sub)

```
1. POST /api/subscriptions/[A]/change-plan { family:"growth", tier, interval }
2. validate: A is caller's, status ∈ {active, trialing}
3. dodo.subscriptions.changePlan(sub_A, { product_id: growthProduct, proration_billing_mode:"prorated_immediately" })
      └─ on failure → abort, DB untouched
4. transaction:
      A.planFamily     = "growth"
      A.maxWorkspaces  = 30
      A.planTier / tierEvents / dodoProductId  = growth tier values
      fanOut(A)  → Workspace 1 gets planFamily="growth"  (social attribution unlocks)
5. webhook subscription.plan_changed(sub_A)  → idempotent re-apply (same end state)
6. user may now attach Workspaces 2..30
```

**The old Standard subscription is NOT cancelled — it is the same row/`subscription_id`, mutated.**

### 6. Multiple Standard → Growth migration flow

```
Given: Subscription A→W1, B→W2, C→W3   (all standard, max 1)

1. validate:  A.count + B.count + C.count  ≤ 30
2. survivor = the sub with the furthest currentPeriodEnd  (say A)
3. dodo.subscriptions.changePlan(sub_A → growthProduct, prorated_immediately)
      └─ on failure → abort, nothing changed
4. transaction:
      A.planFamily="growth", A.maxWorkspaces=30, tier fields
      Workspace 2.subscriptionId = A
      Workspace 3.subscriptionId = A
      A.workspaceCount = count(Workspace where subscriptionId=A)   // = 3, recomputed
      B.status="canceling", B.workspaceCount=0
      C.status="canceling", C.workspaceCount=0
      fanOut(A) → W1, W2, W3
5. dodo.subscriptions.cancel(sub_B, at_period_end)
   dodo.subscriptions.cancel(sub_C, at_period_end)
      └─ on failure → alert + reconciliation-cron retry  (user briefly double-billed; NOT a data/coverage risk)
6. webhooks: plan_changed(A), cancelled(B), cancelled(C), later expired(B/C) → all idempotent no-ops
```

- Workspaces are re-pointed to Growth **before** B/C are cancelled → **zero coverage gap**.
- B/C cancel **at period end** → customer keeps prepaid time, no clawback, no lost credit.
- (Alternative for instant cleanup: `cancel now` + manual goodwill coupon on A — Decision D2.)

### 7. Growth → Standard downgrade flow

```
Given: Subscription G (growth, max 30) covering W1..W10

1. UI blocks — user MUST pick keepWorkspaceId (e.g. W1) and acknowledge the other 9 pause
2. G.pendingPlanChange = { effectiveAt: G.currentPeriodEnd, targetFamily:"standard", targetTier, targetInterval, keepWorkspaceId: W1 }
3. dodo.subscriptions.changePlan(sub_G → standardProduct, proration_billing_mode:"do_not_bill")
      // do_not_bill = applies at next renewal, no charge now, billing date preserved
4. until effectiveAt: nothing changes — user keeps Growth + all 10 sites (already paid for)
5. at effectiveAt (subscription.renewed / plan_changed webhook; reconciliation cron backstop):
      G.planFamily="standard", G.maxWorkspaces=1, tier fields
      W1 stays attached;  G.workspaceCount = 1
      W2..W10:  subscriptionId=null;  cache → subscriptionStatus="inactive", planFamily="standard", usageLimit=0
      fanOut
      clear G.pendingPlanChange
6. W2..W10 show the billing wall. Each: buy own Standard sub,  OR  user re-upgrades G to Growth → re-attach (Scenario 5)
```

**No `delete` is ever called.** Workspaces, tracked events, customers, Tinybird data — all untouched; only the FK is nulled.

### 8. Add Website decision flow

```
click "Add Website"
        │
        ▼
POST /api/workspaces  → Workspace W (inactive, subscriptionId = null)
        │
        ▼
GET /api/billing/context   (user-scoped)
        │
        ├─ user has Growth sub covering < 30 websites  ─────────► show:
        │                                                          • Add to Growth (N/30 websites) — no charge   → attach
        │                                                          • Buy Standard for this website               → checkout
        │
        ├─ user has Growth sub already covering 30 websites  ───► show:
        │                                                          • Buy Standard for this website               → checkout
        │                                                          • Remove an existing website from Growth first (data preserved) → detach, then attach
        │                                                          (NO "second Growth plan" option)
        │
        ├─ user has 1+ Standard sub, no Growth  ────────────────► show BOTH (never force):
        │                                                          • Buy Standard for this site    → POST /api/subscriptions {intent:"standard", targetWorkspaceId:W}
        │                                                          • Switch to Growth (up to 30)   → POST /api/subscriptions {intent:"growth", targetWorkspaceId:W, consolidateStandardSubIds:[...]}
        │
        └─ user has no billing  ───────────────────────────────► show:
                                                                   • Start free trial (if freeTrialUsedAt == null)  → cardless trial sub
                                                                   • Buy Standard   • Buy Growth
```

The server has **no** code path that returns "you must upgrade to Growth." `intent:"standard"` is always accepted.

### 9. Dodo customer / subscription mapping

| Concept | Dodo | Convrs |
|---|---|---|
| Billing identity | `customer_id` (`cus_…`) — one per buyer | `User.dodoCustomerId @unique` |
| A paid plan | `subscription_id` (`sub_…`) — many per customer | `Subscription` row, `dodoSubscriptionId @unique` |
| What was bought | `product_id` (`pdt_…`) — encodes family+tier+interval | resolved via `getPlanFromProductId` → `{planFamily, planTier, interval}` stored on `Subscription` |
| Coverage | (Dodo has no concept) | `Workspace.subscriptionId` FK + `Subscription.maxWorkspaces` |

**Binding rules:**
1. `Subscription` row is created **before** checkout (`status=inactive`, `dodoSubscriptionId=null`); its id travels in `metadata.internalSubscriptionId`.
2. `subscription.active` → bind `dodoSubscriptionId` by `metadata.internalSubscriptionId` (fallback: upsert by `dodoSubscriptionId`).
3. All later events → look up by `dodoSubscriptionId`.
4. Checkout always attaches the existing `customer_id` when `User.dodoCustomerId` is set, so one customer accretes all subscriptions.
5. Customer Portal / invoices / payment methods → keyed on `User.dodoCustomerId` (shows every subscription).

### 10. Webhook synchronization strategy

1. **Verify signature** (`client.webhooks.unwrap`) — reject 401 on failure.
2. **Dedup**: `DodoWebhookEvent` table, PK `webhook-id`. `createMany({ skipDuplicates: true })`. Already `done` → `200`. In-flight & recent → `200`. Stale `processing` → re-process (safe).
3. **Resolve** the `Subscription` (by `metadata.internalSubscriptionId` for `active`, else by `dodoSubscriptionId`). Missing row on a non-`active` event → `200`, wait for `active`.
4. **Out-of-order guard**: skip if `event.timestamp < Subscription.lastEventAt`.
5. **One transaction**: update `Subscription` (absolute values) → `workspace.updateMany` fan-out (single statement) → `workspaceCount = count(...)` recompute → mark `DodoWebhookEvent.status = "done"`. Any throw → full rollback → non-2xx → Dodo retries (≤8×).
6. **Side effects** (welcome email, onboarding-complete) gated on their own `Subscription` flags, fired **after** the transaction commits.
7. **Respond < 15 s** (drop the current fire-and-forget).
8. **Reconciliation cron** (hourly): `dodo.subscriptions.retrieve` per active `Subscription`, re-run fan-out on drift; also applies due `pendingPlanChange`s and expires lapsed subs. This is the safety net for missed webhooks.
9. Retain `DodoWebhookEvent` ~90 days, then prune.

Idempotency holds because: `Subscription` writes are absolute, fan-out is `updateMany` to absolute values, `workspaceCount` is recomputed not incremented, side effects have dedicated flags.

### 11. Trial behaviour

| Question | Answer |
|---|---|
| Granularity | **One 14-day cardless trial per User, lifetime.** Keep `User.freeTrialUsedAt`. |
| Where it lives | On the **first `Subscription`** the user creates (Standard or Growth): `status="trialing"`, `trialEndsAt`, `dodoSubscriptionId=null`. |
| Does each independent Standard sub get its own trial? | **No.** Only the user's first subscription. Otherwise: make N workspaces → N free trials (abuse). |
| Add a website under an already-trialing **Growth** sub | New workspace **inherits** the sub's `trialEndsAt` instantly. No separate trial, no charge — it consumes a seat. |
| Add a website while your first workspace is on a **Standard** trial | Standard trial covers 1 site only. Options for site #2: buy its own Standard sub (card required), or convert the account to Growth — a paid Growth checkout with `trial_period_days = remaining days` (mirrors the existing `getRemainingTrialDays` conversion in `billing/upgrade/route.ts`). |
| Convert trial → paid | Checkout with `subscription_data.trial_period_days = getRemainingTrialDays(trialEndsAt)`; Dodo captures the card now, charges at trial end. Webhook binds `dodoSubscriptionId`, grants limits immediately for `status ∈ {active, trialing}`. |
| Trial expiry | Driven by the reconciliation cron / webhook keyed on the **`Subscription`** (not per-request per-workspace). On expiry with no card: `status="inactive"`, fan out → **all** sibling workspaces flip together. Remove the per-request flip currently in `withWorkspace`. |
| Denormalization | `trialEndsAt` → `Workspace.freeTrialEndDate` for every attached workspace, so `free-trial-banner.tsx` / `hasWorkspaceAccess` work unchanged. |

### 12. Usage / event-limit behaviour

| Question | Answer |
|---|---|
| Per-site or pooled across the Growth 30? | **Per-site.** Each attached workspace gets `usageLimit = Subscription.tierEvents`. Matches "1 workspace = 1 website" and the flat per-plan pricing (customer isn't buying a shared pool). **Decision D1 — confirm.** |
| Counter | `Workspace.usage` stays real + per-workspace (incremented in `apps/ingestion/track.ts`). Fan-out never touches it. |
| Enforcement | `track.ts` blocks when `usage >= usageLimit`. Make it **atomic**: `updateMany({ where:{ id, usage:{ lt: usageLimit } }, data:{ usage:{ increment:1 } } })`; `count === 0` ⇒ over limit (fixes the current check-then-act race). |
| Monthly reset | **Currently missing — pre-existing bug.** Add: reset `usage=0` on `subscription.renewed` (primary), plus a daily cron that zeroes `usage` for workspaces whose `Subscription.currentPeriodStart` rolled over (backstop). Anchor = subscription period, not calendar month (**Decision D8**). |
| 95% warning email | Keep existing `usage_limit_95` `SentEmail` dedup; fires per-workspace. |
| `10M+` tier | `tierEvents` sentinel (`Number.MAX_SAFE_INTEGER` or a large constant). `usage >= usageLimit` never trips (fine); 95% math → special-case to "never warn" or warn at a fixed absolute number. |
| Over-limit behaviour | Hard block on ingestion (`403 exceeded_limit`, as today). Dashboard stays readable. Optionally: soft overage billing later — out of scope. |

### 13. Remaining architectural decisions you must make

| # | Decision | Recommendation |
|---|---|---|
| **D1** | Growth event limit: per-site vs pooled across 30 | **Per-site** = `tierEvents` each. |
| **D2** | Consolidation (multi-Standard → Growth): cancel old subs *at period end* / *now with lost credit* / *now + goodwill coupon* | **Cancel at period end**, re-point workspaces immediately. Brief harmless overlap; no lost value. |
| **D3** | Tier representation: `String` keyed to `pricing.tsx` vs expand the `WorkspacePlan` enum | **`String` (`planTier`)** on `Subscription` + `Workspace`; retire `WorkspacePlan` for tiering. Pricing changes don't need enum migrations, and it kills the "Growth tier vs Growth family" name collision. |
| **D4** | Growth→Standard downgrade timing: immediate (prorated credit) vs next renewal (`do_not_bill`) | **Next renewal / `do_not_bill`** — no surprise charge, keeps all sites until paid period ends. |
| **D5** | Standard sub whose only workspace is deleted | **Auto-schedule `cancel(at_period_end)`** + notify. (Not "keep as spare seat" — a Standard sub with 0 workspaces is dead weight.) |
| **D6** | `past_due` grace policy — today dashboard **locks out**, ingestion **still accepts** | **Unify**: allow dashboard read + ingestion for a grace window (e.g. **7 days** from `paymentFailedAt`), then hard-block both. Apply in `hasWorkspaceAccess` **and** `track.ts`. |
| **D7** | Trial: cardless (current) vs card-required-upfront; once-per-user vs once-per-sub | **Cardless, once per user lifetime**, first subscription only. |
| **D8** | Usage reset anchor: calendar month vs subscription period | **Subscription period** (`currentPeriodStart`). Add the reset — it doesn't exist today. |
| **D9** | Who can manage a Growth subscription (spans workspaces) | **Only `Subscription.ownerUserId`** for now. A workspace `billing`-role teammate cannot touch a cross-workspace sub. Document the limitation; revisit if/when an `Organization` entity is added. |
| **D10** | Growth **yearly** 100K and 200K are both **$390** in your table | Confirm intentional (not a typo) before the 36 Dodo products are created. |
| **D11** | `maxWorkspaces = 30` — snapshot per subscription, or read live from config? | **Snapshot on the row.** Raising the global cap later shouldn't silently reprice existing plans; a migration can bump existing rows deliberately. |
| **D12** | Re-subscribe after full Growth cancellation — auto-re-attach the previously-covered workspaces? | **Offer** "re-attach your N previous sites" (query `Workspace where subscriptionId = null AND owner = me`). Don't auto-attach silently. |
| **D13** | Are Enterprise / Ultimate (top tiers) still self-serve checkout, or sales-led? | Affects whether **all** 9 tiers × 2 intervals × 2 families = **36 Dodo products** are self-serve, or fewer + a "contact us". |
| **D14** | `Invoice.workspace` has no `onDelete` (pre-existing) — `Cascade` vs `SetNull` | Business/accounting call. `SetNull` if invoices must be retained post-workspace-deletion; `Cascade` otherwise. Fix in the same migration. |
| **D15** | Existing customers with a broken 2nd-workspace `dodoCustomerId` (current `@unique` hack) | Migration must fetch the real `customer_id` per subscription from the Dodo API and reconcile onto `User`. Budget for manual review of conflicts. |
| **D16** | 36 Dodo products don't exist yet with the target tiers/prices | **Launch blocker.** Build a script that diffs `pricing.tsx` product ids against `dodo.products.list()` before enabling checkout. |

---

## What I need from you

Approve (or amend) the model in **§1–§2** and the decisions **D1–D16**. On approval I'll produce the implementation plan (migrations, endpoint-by-endpoint diffs, fan-out module, webhook rewrite, UI, backfill script, tests) as a separate step — still no code until that plan is also signed off if you want that checkpoint.

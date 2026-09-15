# Dodo product setup — Deploy 0

Scope: create + verify the **36 Convrs workspace-subscription products** in Dodo
Payments (Test Mode). This is Deploy 0 of `docs/billing-implementation-plan.md`.
It does **not** touch the Prisma schema, application billing logic, workspace
creation, webhooks, or `packages/utils/pricing.tsx` (that is Deploy 3).

## Files

| File | Purpose |
|---|---|
| `products-spec.ts` | Canonical spec for all 36 products. Prices transcribed verbatim from `docs/billing-invariants.md §1`. Single source of truth. |
| `products-spec.test.ts` | Offline self-check: parses the approved doc table and asserts the spec matches it + is internally consistent. No network. |
| `dodo-product-audit.ts` | `--list` / `--verify` (read-only) and `--create` (write, Test Mode only). |
| `products.created.json` | `spec_key → product_id` map, written by `--create`, consumed by `--verify` and (later) Deploy 3. |

## Commands

Offline self-check (run first, always):

```
pnpm --filter web exec vitest run scripts/dodo/products-spec.test.ts
```

Read-only inventory of what's already in Dodo (this environment):

```
node --env-file=apps/web/.env node_modules/.pnpm/tsx@4.7.0/node_modules/tsx/dist/cli.mjs apps/web/scripts/dodo/dodo-product-audit.ts --list
```

Create the 36 products (Test Mode only — refuses otherwise):

```
node --env-file=apps/web/.env node_modules/.pnpm/tsx@4.7.0/node_modules/tsx/dist/cli.mjs apps/web/scripts/dodo/dodo-product-audit.ts --create
```

Verify every product matches the spec:

```
node --env-file=apps/web/.env node_modules/.pnpm/tsx@4.7.0/node_modules/tsx/dist/cli.mjs apps/web/scripts/dodo/dodo-product-audit.ts --verify
```

`--create` is idempotent and resumable (skips products already recorded in
`products.created.json` or already present in Dodo with a matching
`metadata.spec_key`).

## Product attributes (all 36)

- `price.type` = `recurring_price`, `currency` = `USD`, `discount` = 0, `purchasing_power_parity` = `false`
- `payment_frequency_count` = 1; `payment_frequency_interval` = `Month` (monthly plans) / `Year` (yearly plans) — the billing cadence
- `subscription_period_count` = **20**, `subscription_period_interval` = **`Year`** for *every* product (monthly and yearly). The term MUST be strictly longer than the payment frequency or Dodo expires the subscription after one cycle instead of renewing ([subscription integration guide](https://docs.dodopayments.com/developer-resources/subscription-integration-guide)). 20 years = effectively perpetual; matches the longest-lived existing Convrs product.
- `tax_category` = `saas`, `tax_inclusive` = `false` — matches every existing Convrs product (verified via `products.retrieve`)
- `trial_period_days` = **0** — the 14-day trial is injected per checkout via
  `checkoutSessions.create({ subscription_data: { trial_period_days } })`, never on the product.
- `metadata` = `{ app: "convrs", purpose: "workspace_subscription", plan_schema: "v2",
  family, tier, events_label, events_included, interval, max_workspaces, spec_key }`
- name = `Convrs <Standard|Growth> — <events> events / <month|year>`

## The 36 products (prices = approved table, verbatim)

`spec_key` = `<family>.<tier>.<interval>` · price shown as USD (`priceCents` = ×100)

| # | spec_key | family | tier | events | interval | price | cents | freq |
|--:|---|---|---|---|---|--:|--:|---|
| 1 | `standard.t10k.monthly` | standard | t10k | 10K | monthly | $9 | 900 | Month |
| 2 | `standard.t10k.yearly` | standard | t10k | 10K | yearly | $90 | 9000 | Year |
| 3 | `standard.t100k.monthly` | standard | t100k | 100K | monthly | $19 | 1900 | Month |
| 4 | `standard.t100k.yearly` | standard | t100k | 100K | yearly | $190 | 19000 | Year |
| 5 | `standard.t200k.monthly` | standard | t200k | 200K | monthly | $29 | 2900 | Month |
| 6 | `standard.t200k.yearly` | standard | t200k | 200K | yearly | $290 | 29000 | Year |
| 7 | `standard.t500k.monthly` | standard | t500k | 500K | monthly | $49 | 4900 | Month |
| 8 | `standard.t500k.yearly` | standard | t500k | 500K | yearly | $490 | 49000 | Year |
| 9 | `standard.t1m.monthly` | standard | t1m | 1M | monthly | $69 | 6900 | Month |
| 10 | `standard.t1m.yearly` | standard | t1m | 1M | yearly | $690 | 69000 | Year |
| 11 | `standard.t2m.monthly` | standard | t2m | 2M | monthly | $89 | 8900 | Month |
| 12 | `standard.t2m.yearly` | standard | t2m | 2M | yearly | $890 | 89000 | Year |
| 13 | `standard.t5m.monthly` | standard | t5m | 5M | monthly | $129 | 12900 | Month |
| 14 | `standard.t5m.yearly` | standard | t5m | 5M | yearly | $1,290 | 129000 | Year |
| 15 | `standard.t10m.monthly` | standard | t10m | 10M | monthly | $169 | 16900 | Month |
| 16 | `standard.t10m.yearly` | standard | t10m | 10M | yearly | $1,690 | 169000 | Year |
| 17 | `standard.t10m_plus.monthly` | standard | t10m_plus | 10M+ | monthly | $199 | 19900 | Month |
| 18 | `standard.t10m_plus.yearly` | standard | t10m_plus | 10M+ | yearly | $1,990 | 199000 | Year |
| 19 | `growth.t10k.monthly` | growth | t10k | 10K | monthly | $19 | 1900 | Month |
| 20 | `growth.t10k.yearly` | growth | t10k | 10K | yearly | $190 | 19000 | Year |
| 21 | `growth.t100k.monthly` | growth | t100k | 100K | monthly | $39 | 3900 | Month |
| 22 | `growth.t100k.yearly` | growth | t100k | 100K | yearly | $390 | 39000 | Year |
| 23 | `growth.t200k.monthly` | growth | t200k | 200K | monthly | $59 | 5900 | Month |
| 24 | `growth.t200k.yearly` | growth | t200k | 200K | yearly | **$390** | 39000 | Year |
| 25 | `growth.t500k.monthly` | growth | t500k | 500K | monthly | $99 | 9900 | Month |
| 26 | `growth.t500k.yearly` | growth | t500k | 500K | yearly | $990 | 99000 | Year |
| 27 | `growth.t1m.monthly` | growth | t1m | 1M | monthly | $139 | 13900 | Month |
| 28 | `growth.t1m.yearly` | growth | t1m | 1M | yearly | $1,390 | 139000 | Year |
| 29 | `growth.t2m.monthly` | growth | t2m | 2M | monthly | $179 | 17900 | Month |
| 30 | `growth.t2m.yearly` | growth | t2m | 2M | yearly | $1,790 | 179000 | Year |
| 31 | `growth.t5m.monthly` | growth | t5m | 5M | monthly | $259 | 25900 | Month |
| 32 | `growth.t5m.yearly` | growth | t5m | 5M | yearly | $2,590 | 259000 | Year |
| 33 | `growth.t10m.monthly` | growth | t10m | 10M | monthly | $339 | 33900 | Month |
| 34 | `growth.t10m.yearly` | growth | t10m | 10M | yearly | $3,390 | 339000 | Year |
| 35 | `growth.t10m_plus.monthly` | growth | t10m_plus | 10M+ | monthly | $399 | 39900 | Month |
| 36 | `growth.t10m_plus.yearly` | growth | t10m_plus | 10M+ | yearly | $3,990 | 399000 | Year |

Row 22 and row 24 are both **$390/year** — intentional (`docs/billing-invariants.md §1`, D10).

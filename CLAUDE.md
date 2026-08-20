# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Convrs is a customer/revenue **attribution analytics platform** with a built-in **AI-crawler (bot) traffic detector**. Customers embed a tracking snippet (and optionally the `@convrs/ai-bot-sdk` package) on their site; Convrs attributes visitors/sales to marketing sources (UTM, social mentions on X/Reddit, ads) and reports on AI-bot crawler traffic.

The repo is a fork of the open-source **Dub.co** link-management SaaS template (pnpm + Turborepo monorepo). Link-shortening itself has been removed from the product — there is no `Link` model in the database — but the Dub lineage still shows up in places: root package is named `dub-monorepo`, license is `AGPL-3.0-or-later`, Tinybird datasources are named `dub_click_events`/`dub_sales_events_mv`, and some code/strings still say "Boilercode"/Dub. Treat these as historical artifacts, not indications of current product direction.

## Monorepo layout

- `apps/web` — main Next.js 16 (App Router) app: dashboard, marketing/auth pages, and all `/api` routes. This is where almost all product work happens.
- `apps/ingestion` — standalone Express server, deployed separately as `ingest.convrs.dev`. Receives click tracking, AI-bot events, and customer revenue-provider webhooks.
- `packages/db` — Prisma schema (split across files) + multiple client entrypoints (Node, edge, types-only).
- `packages/analytics` — shared analytics domain logic (bot detection, attribution, event recording, exports) imported by both `apps/web` and `apps/ingestion`. Not a server.
- `packages/tinybird` — Tinybird datasource/pipe definitions (the real-time, ClickHouse-backed analytics engine).
- `packages/tracker` — client-side tracking snippet, built as a minified IIFE (`analytics.js`), served at `/script.js` via rewrite to `cdn.convrs.dev`.
- `packages/ui` — shared React component library (tsup build, Tailwind + CVA).
- `packages/utils` — shared constants/functions, including hostname sets (`APP_HOSTNAMES`, `API_HOSTNAMES`) used for request routing.
- `packages/email` — React Email templates + send helper (Resend or SMTP).
- `packages/tailwind-config`, `packages/tsconfig` — shared config packages consumed via `workspace:*`.

## Commands

Root (Turborepo):
- `pnpm install`
- `pnpm dev` — runs `turbo dev` across all apps
- `pnpm build` — runs `turbo build`
- `pnpm lint` — runs `turbo lint`
- `pnpm test` — runs `turbo run test`
- `pnpm format` / `pnpm prettier-check` — Prettier over `**/*.{ts,tsx,md}`
- `pnpm build:packages` — build only `packages/*`

`apps/web`:
- `pnpm --filter web dev` — `next dev --turbopack --port 8888` concurrently with `prisma studio`
- `pnpm --filter web build` — generates the Prisma client, then `next build`
- `pnpm --filter web test` — `pnpm prisma:generate && vitest -no-file-parallelism --bail=1` (tests are **not** run in parallel and the suite bails on first failure)
- Single test: `cd apps/web && npx vitest run path/to/file.test.ts`
- `pnpm --filter web prisma:generate` / `prisma:push` / `prisma:studio` / `prisma:format` — all wrapped with `dotenv-flow -e .env` and delegate to `@repo/db`

`apps/ingestion`:
- `pnpm --filter ingestion dev` — `tsx src/index.ts`
- `pnpm --filter ingestion build` — `tsc`

`packages/db` (usually invoked via the `web` wrappers above, not directly):
- `pnpm --filter @repo/db prisma:generate` / `prisma:push` / `prisma:migrate` / `prisma:studio`

There is no `.github/workflows` CI configured in this repo, and only one test file exists (`apps/web/lib/analytics/traffic-spike.test.ts`) despite vitest being fully wired up — don't assume test coverage exists for code you're changing.

**Type checking**: there is no root `check-types` script (and none in `apps/web`, which relies on `next build` to surface type errors). Run `turbo run check-types` directly to typecheck the packages that define it (`analytics`, `email`, `ui`, `utils` — each runs `tsc --noEmit`).

## Architecture

### Hostname-based routing
`apps/web/proxy.ts` is the root middleware. It parses the request hostname and dispatches to `AppMiddleware` (dashboard, in `lib/middlewarre/app.ts` — note the misspelled directory name, it's intentional/existing, not a typo to "fix") or `ApiMiddleware` (`lib/middlewarre/api.ts`) based on the `APP_HOSTNAMES`/`API_HOSTNAMES` sets exported from `@repo/utils`.

### Multi-tenancy
`Workspace` (`packages/db/schema/workspace.prisma`) is the tenant boundary, joined to `User` via `WorkspaceUsers` (role-based). `planFamily` (`standard` | `growth`, etc.) plus `plan` drive feature gating — **entitlement checks must go through `apps/web/lib/billing/entitlement.ts`** (e.g. `workspaceHasSocialAttribution`) rather than re-deriving `planFamily === "growth"` checks inline; that file is documented in-repo as the single source of truth for gating.

### Auth
NextAuth v4, JWT session strategy, Prisma adapter — configured in `apps/web/lib/auth/options.ts`. Providers: Google, GitHub, email magic link, credentials (email+password), Passkeys (via Hanko / `@teamhanko/passkeys-next-auth-provider`), and SAML SSO (BoxyHQ `@boxyhq/saml-jackson`, both IdP-initiated and SP-initiated flows, configured in `lib/jackson.ts`). TOTP 2FA is layered on top via a short-lived signed cookie + a dedicated `two-factor-challenge` credentials provider. The `jwt` callback also checks a Redis-backed revocation list (`redisWithTimeout`) on every request so a revoked session is invalidated immediately, not just at next token refresh — it fails open (allows the request) if Redis times out.

### Billing — two unrelated payment concerns, don't conflate them
1. **Convrs's own subscription billing** (charging a workspace for using Convrs): **Dodo Payments** (`apps/web/lib/dodo/`) is the live provider — its own doc comment describes it as a "drop-in replacement for lib/stripe.ts". `apps/web/lib/stripe/` still exists in parallel; check which is actually wired into the checkout/webhook flow you're touching before assuming Stripe is authoritative.
2. **Customer revenue integrations** (a workspace connects *their own* payment processor so Convrs can attribute sales to marketing/social sources): Stripe, Paddle, and Polar, connected via `apps/web/app/api/integrations/[provider]/` and surfaced through `lib/swr/use-integration.ts` on the Revenue settings page. `apps/ingestion/src/controllers/revenue/` additionally handles inbound webhooks for Stripe, Polar, Dodo, Paddle, and LemonSqueezy on the ingestion side.

### Data model (`packages/db/schema/*.prisma` — one Prisma schema split across ~14 files, no single monolithic file)
- `schema.prisma` — generator/datasource config + `User`/`Account`/`Session` (NextAuth)
- `workspace.prisma` — `Workspace`, `WorkspaceUsers`, `WorkspaceInvite`, `Funnel`/`FunnelStep`
- `customer.prisma` — `Customer`, with `AttributionStatus` (visitor → paying customer attribution)
- `social-media.prisma` — the largest file: `SocialIntegration`, `SocialAccount`, `SocialPost`, `SocialMention`, `SocialKeyword`, `SocialAttributionHandle`, `LinkAttribution`, `SocialSyncJob`, `AccountBlocklist` — social listening/attribution for X and Reddit
- `domain.prisma` — `WorkspaceDomain`: first-party tracking proxy domains (customer subdomain CNAMEs to `proxy.convrs.dev`), not link-shortener domains
- `tracked-events.prisma`, `payment.prisma`, `invoice.prisma`, `stripe.prisma` (`Integration`, `ExchangeRate`), `webhook.prisma`, `token.prisma`, `alert.prisma`, `jackson.prisma` (SAML store), `notification-preference.prisma`

`packages/db` exposes multiple entrypoints (see its `package.json` `exports`):
- `.` → `index.ts` — full Node Prisma client using the Neon serverless adapter
- `./edge` → `edge.ts` — raw tagged-SQL client via `@neondatabase/serverless` (no Prisma client), for edge runtime
- `./client` → `client.ts` — re-exports Prisma enums/types only, for importing types without pulling in the client
- `./edge-raw` is declared in `package.json` but **`edge-raw.ts` does not exist in the package** — this export is currently dangling; importing it will fail.

### Analytics / event pipeline
**Tinybird** (`packages/tinybird`) is the real-time analytics engine (ClickHouse-backed), queried from the web app via `@chronark/zod-bird` (`apps/web/lib/tinybird/client.ts`, `apps/web/lib/social/tinybird-client.ts`).

**`packages/analytics`** is a shared *library*, not a server, despite depending on `fastify` — it holds bot detection (`utils/detect-bot.ts`, `utils/bots-list.ts`), attribution logic, event recording, customer upsert, and workspace data export, and is imported by both `apps/web` and `apps/ingestion`.

**`apps/ingestion`** is a standalone Express service (deployed as `ingest.convrs.dev`, referenced from `apps/web/next.config.js` via a rewrite of `/api/track`) that receives:
- click tracking (`POST /api/track`)
- AI-crawler bot events (`POST /api/ai-crawls`) sent by the published `@convrs/ai-bot-sdk` package that customers embed on their own sites, classified via `classifyBotUserAgent`
- revenue-provider webhooks (Stripe/Polar/Dodo/Paddle/LemonSqueezy)

**`packages/tracker`** builds the actual client-side snippet (`analytics.js`) that customers embed, served at `/script.js` via rewrite to `cdn.convrs.dev`.

### State management & data fetching
No global client state library (no Redux/Zustand/Jotai) — server state is fetched with **SWR**, one hook per resource under `apps/web/lib/swr/` (`use-workspace`, `use-customers`, `use-webhooks`, `use-attribution`, etc.), paired with `lib/swr/mutate.ts`. Mutations go through **`next-safe-action`** (`apps/web/lib/actions/`), layered in `lib/actions/safe-action.ts`:
- `actionClient` — no auth
- `authUserActionClient` — requires a session
- `authActionClient` — requires a session *and* a `workspaceId` in the input; resolves and attaches the caller's `WorkspaceUsers` role to context

### Frontend
Next.js 16 App Router. Route groups under `apps/web/app/app.convrs.dev/`: `(auth)`, `(dashboard)`, `(invites)`, `(onboarding)`, `(shared)`. Workspace-scoped dashboard pages live under `(dashboard)/[slug]/...`, with a `(premium)` sub-group gated by plan. Styling is Tailwind CSS 3 via `packages/tailwind-config`, extended per-app; shared components live in `packages/ui` (tsup build, class-variance-authority).

**React version mismatch**: `apps/web` pins `react`/`react-dom` `^18.3.1`, while `apps/ingestion` and several packages (`analytics`, `email`, `utils`) use React `^19.x`. Be deliberate about which app/package you're editing when touching React APIs.

## TypeScript

`packages/tsconfig/base.json` sets `strict: true`, but `apps/web/tsconfig.json` overrides this to `strict: false` (keeping `strictNullChecks: true`) and targets `es5` — the web app itself is not fully strict even though shared packages generally are. Path aliases (`@/lib/*`, `@/ui/*`, `@/app/*`, `@/pages/*`, `@/styles/*`) are only configured in `apps/web`.

## Known technical debt / oddities

These are worth knowing about before you assume something is broken or duplicated by mistake:
- `packages/db`'s `./edge-raw` export points at a file that doesn't exist.
- `apps/web/tsconfig.json` and `apps/web/tailwind.config.ts` both reference `../../packages/blocks/src/**`, but `packages/blocks` does not exist anywhere in the workspace.
- `apps/ingestion/src/index.ts` has a large block of dead, duplicated commented-out server setup preceding the live implementation.
- Four payment SDKs are installed (Stripe, Paddle, Polar, Dodo) plus LemonSqueezy webhook handling — see the Billing section above before assuming this is unintentional duplication.
- Almost no automated test coverage and no CI workflow currently exist.
- **`vercel.json` schedules a cron at `/api/cron/social/attribution-reconciliation`, but the actual route directory is `apps/web/app/api/cron/social/attribution-reconcilation`** (missing the second "i") — the spelling mismatch means this cron 404s and never runs. Fix by renaming one side to match the other.

## Environment variables (names only)

**Auth**: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `HANKO_API_KEY`, `NEXT_PUBLIC_HANKO_TENANT_ID`, `DOCS_SITE_INTERNAL_TOKEN`

**Database**: `DATABASE_URL`

**Billing (Convrs's own)**: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT`; (legacy/parallel Stripe) `STRIPE_SECRET_KEY`, `STRIPE_APP_SECRET_KEY`, `STRIPE_APP_SECRET_KEY_TEST`, `STRIPE_APP_SECRET_KEY_SANDBOX`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE`

**Redis / queue**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`

**Analytics (Tinybird)**: `TINYBIRDS_API_KEY`, `TINYBIRDS_API_URL`, `NEXT_PUBLIC_WS_URL`

**Social integrations**: `X_API_BEARER_TOKEN`, `X_API_MONTHLY_READ_CAP`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `WORKER_SHARED_SECRET`

**Storage (S3-compatible)**: `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_ENDPOINT`, `STORAGE_PUBLIC_BUCKET`, `STORAGE_PRIVATE_BUCKET`, `STORAGE_BASE_URL`

**Email**: `RESEND_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`

**Vercel / domains API**: `VERCEL_PROJECT_ID`, `TEAM_ID_VERCEL`, `VERCEL_API_KEY`, `VERCEL`, `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV`, `VERCEL_REGION`

**App / misc**: `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_DOMAIN`, `NEXT_PUBLIC_NGROK_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `CRON_SECRET`, `NODE_ENV`, `PORT`, `BASE_URL`, `INGEST_API_URL`, `COOKIELESS_SALT_SECRET`, `ENCRYPTION_KEY`

This list was gathered by grepping `process.env.*` usage and is not guaranteed exhaustive.

## Deployment

`apps/web` deploys to Vercel (`vercel.json`), which also defines Vercel Cron jobs: `update-exchange-rates` (daily), `weekly-summary` (weekly), `traffic-spike` (daily), and the social pipeline — `social/x-discovery`, `social/x-mentions`, `social/reddit-mentions`, `social/link-resolution`, `social/attribution-reconciliation` (all daily, staggered by 10 minutes). Upstash QStash (`apps/web/lib/cron/`) is used alongside Vercel Cron for additional scheduling/queueing.

`apps/ingestion` is a long-running Express server and does **not** deploy to Vercel — it's deployed separately as `ingest.convrs.dev`.

Known hostnames: `app.convrs.dev` (dashboard, matched via `APP_HOSTNAMES`), an API hostname matched via `API_HOSTNAMES`, `cdn.convrs.dev` (tracker snippet), `ingest.convrs.dev` (ingestion service), `proxy.convrs.dev` (default CNAME target for customer tracking-proxy domains).

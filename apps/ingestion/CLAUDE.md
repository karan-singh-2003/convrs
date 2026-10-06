# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this app. See the root `CLAUDE.md` first for how this service fits into the overall architecture.

## What this is

A plain Express server (not Next.js, not serverless) that is deployed independently as `ingest.convrs.dev`. `apps/web` proxies `/api/track` to it via a Next.js rewrite; it is not reachable through `apps/web`'s own routing/middleware. It imports and reuses `@repo/analytics`, `@repo/db`, `@repo/email`, and `@repo/utils` directly — keep shared logic in those packages rather than duplicating it here.

## Routes (`src/index.ts`)

- `POST /api/track` — click tracking (`controllers/track.ts`)
- `POST /api/ai-crawls` — AI-bot crawler events sent by the published `@convrs/ai-bot-sdk` package, classified via `classifyBotUserAgent` (`controllers/track-ai-bot.ts`)
- `POST /api/stripe/webhook/:workspaceId`, `/api/polar/webhook/:workspaceId`, `/api/dodo/webhook/:workspaceId`, `/api/lemonsqueezy/webhook/:workspaceId`, `/api/paddle/webhook/:workspaceId` — customer revenue-provider webhooks (`controllers/revenue/`), mounted with `express.raw()` **before** the global `express.json()` middleware because their signature verification needs the raw body
- `GET /health`

**`src/index.ts` currently starts with a large block of dead, duplicated commented-out code** (an earlier version of the same server) above the live implementation — don't mistake it for the active config, and feel free to delete it if you're touching this file for another reason.

## Tracking pipeline invariants

- `/api/track` order: validate → workspace → entitlement → hostname authorization → block rules → bot gate → (humans only) idempotency → usage claim → Customer → event → goals. Bots never create Customer rows, idempotency keys or usage. Usage is claimed before persistence and released if the event isn't stored.
- The event hostname is always the page URL's host (`data-domain` is only a cookie-scope hint) and must be the workspace domain/subdomain, an `allowedHostnames` entry (`*.x` = wildcard), or anything with `allowAllDomains`. A browser `Origin` must match it. Shared logic: `packages/analytics/src/hostname-auth.ts` (also used by apps/web's heartbeat).
- `/api/ai-crawls` order: validate → workspace (public project token) → bot-token auth (a sent token is always validated; a token is required only when `botTrafficRequireAuth`, default off) → entitlement → hostname → server-side classification (`classifyUserAgent`, client category ignored) → block rules → `eventId` idempotency → daily bot cap (`lib/bot-daily-cap.ts`) → crawler verification (`lib/crawler-verification.ts`) → persist with `authenticated` 0/1.
- Bot events never touch `Workspace.usage`: they're metered by a per-workspace UTC-day Redis counter (`AI_CRAWLS_DAILY_CAP_PER_WORKSPACE`, default 5000; 429 `bot_daily_cap` when reached), so the public project token can't exhaust a customer's human-analytics quota. `INGEST_FORWARD_SECRET` is unrelated to Bot Traffic.
- Client IP/geo policy lives only in `lib/client-context.ts`: signed hop from apps/web (`INGEST_FORWARD_SECRET` + `x-convrs-client-ip`/`x-convrs-geo-*`), else `CLIENT_IP_HEADER` (defaults to `cf-connecting-ip` on Render), else `req.ip` with `TRUST_PROXY`. Never read `x-debug-ip`, raw `x-forwarded-for`, or client-sent `x-vercel-*`.
- Env: `INGEST_FORWARD_SECRET` (same value in apps/web), `CLIENT_IP_HEADER`, `TRUST_PROXY`, `TRACKING_ALLOW_LOCALHOST` (localhost hostnames; allowed by default only outside production/Render).
- Tests: `pnpm --filter ingestion test` (Node test runner via tsx, `test/*.test.ts`); DB-backed behavior is covered by `apps/e2e`.

## Conventions

- Revenue webhook handlers live one-per-provider under `controllers/revenue/`; shared cross-provider logic (e.g. applying a payment to a `Customer`) goes in `controllers/shared/handle-payment.ts`, not duplicated per provider.
- Redis access goes through `src/lib/redis.ts` (Upstash REST client), matching the pattern in `apps/web/lib/upstash`.
- This service runs with `tsx` in dev (`pnpm dev`) and compiles with plain `tsc` for prod (`pnpm build` → `dist/`, started with `pnpm start`) — there's no bundler here, unlike the tsup-built packages.

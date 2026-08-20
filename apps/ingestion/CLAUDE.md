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

## Conventions

- Revenue webhook handlers live one-per-provider under `controllers/revenue/`; shared cross-provider logic (e.g. applying a payment to a `Customer`) goes in `controllers/shared/handle-payment.ts`, not duplicated per provider.
- Redis access goes through `src/lib/redis.ts` (Upstash REST client), matching the pattern in `apps/web/lib/upstash`.
- This service runs with `tsx` in dev (`pnpm dev`) and compiles with plain `tsc` for prod (`pnpm build` → `dist/`, started with `pnpm start`) — there's no bundler here, unlike the tsup-built packages.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this app. See the root `CLAUDE.md` first for repo-wide architecture (auth, billing, data model, analytics pipeline) — this file only covers conventions specific to `apps/web`.

## Directory layout

- `app/app.convrs.dev/` — the actual dashboard/marketing UI, route-grouped: `(auth)`, `(dashboard)`, `(invites)`, `(onboarding)`, `(shared)`. Workspace-scoped pages live under `(dashboard)/[slug]/...`; `(premium)` sub-routes are plan-gated.
- `app/api/` — REST API routes (webhooks, cron endpoints, integrations, public API under `tokens`/`scim`). Prefer a server action over a new REST route for anything called only from this app's own UI; use `app/api` for webhooks, cron, third-party callbacks, and the public/token-authenticated API.
- `lib/` — almost all business logic; UI components rarely contain logic directly. Key subfolders: `actions/` (next-safe-action mutations), `api/` (REST route handlers' shared logic, including `rbac/permissions.ts` + `rbac/resources.ts`), `auth/`, `billing/`, `swr/` (data-fetching hooks), `zod/schemas/` (validation schemas, one file per domain), `middlewarre/` (hostname routing — note the misspelling is intentional/existing).
- `ui/` — app-specific React components (as opposed to the shared design system in `packages/ui`).

## Conventions

- **Mutations**: use a `next-safe-action` action in `lib/actions/`, built on `actionClient` / `authUserActionClient` / `authActionClient` from `lib/actions/safe-action.ts`. Don't hand-roll auth/workspace checks inline in a route handler when an equivalent action client already does it.
- **Feature gating**: check plan entitlements through `lib/billing/entitlement.ts`, not by comparing `plan`/`planFamily` strings directly.
- **Cron & internal-worker routes** (`app/api/cron/**`): authenticated via a bearer-token check against `CRON_SECRET` (`lib/cron/verify-vercel-signature.ts`) for Vercel Cron, or `WORKER_SHARED_SECRET` for the social-pipeline routes — not via user session. QStash-triggered routes are verified separately via `lib/cron/verify-qstash.ts`.
- **Data fetching**: one SWR hook per resource in `lib/swr/`, following the existing `use-<resource>.ts` naming. There is no global client-side store — don't introduce one.
- **Validation**: Zod schemas live in `lib/zod/schemas/`, one file per domain (e.g. `webhook.ts`, `workspaces.ts`, `bot-filtering.ts`). Reuse/extend an existing schema file rather than inlining `z.object(...)` ad hoc in a route handler when the domain already has a schema file.

## Testing

Run with `pnpm --filter web test` (`vitest -no-file-parallelism --bail=1` — tests run serially and the suite stops at the first failure, so fix and re-run rather than trying to read past a failure). Test coverage in this app is minimal today (one test file); don't assume behavior is covered just because it's plausible-looking production code.

## Dev server

`pnpm --filter web dev` starts Next.js on port **8888** (not 3000) with `--turbopack`, concurrently with `prisma studio`.

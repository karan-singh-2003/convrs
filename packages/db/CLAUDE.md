# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this package. See the root `CLAUDE.md` first for a summary of the data model — this file covers how the package itself is structured and used.

## Schema is split across files, not one `schema.prisma`

`schema/` contains ~14 `.prisma` files (`schema.prisma`, `workspace.prisma`, `customer.prisma`, `social-media.prisma`, `domain.prisma`, `tracked-events.prisma`, `payment.prisma`, `invoice.prisma`, `stripe.prisma`, `webhook.prisma`, `token.prisma`, `alert.prisma`, `jackson.prisma`, `notification-preference.prisma`), loaded together via `prisma.config.ts` (`schema: "./schema"`, Prisma's multi-file schema support). Only `schema.prisma` declares the `generator`/`datasource` blocks. When adding a new model, put it in the most relevant existing file rather than creating a new one, unless it's clearly starting a new domain.

Migrations live in `schema/migrations/` (~39 migrations as of this writing) and are generated with `pnpm prisma:migrate` — run from `apps/web` via the `dotenv-flow`-wrapped script (`pnpm --filter web prisma:push` etc.), not directly in this package, so the right `.env` is loaded.

## Three client entrypoints — pick the right one

Declared in `package.json` `exports`:
- **`@repo/db`** (`index.ts`) — the full Node.js Prisma client, wired to the Neon serverless driver adapter (`@prisma/adapter-neon`). Use this in normal server-side code (API routes, server actions, `apps/ingestion`).
- **`@repo/db/edge`** (`edge.ts`) — a raw tagged-SQL client via `@neondatabase/serverless`'s `neon()`, with **no Prisma client**. Use only where the Prisma client can't run (edge runtime) and hand-write SQL.
- **`@repo/db/client`** (`client.ts`) — re-exports only Prisma-generated enums and types (`Workspace`, `WorkspaceRole`, `RevenueProvider`, etc.), no client instance. Use this when a module only needs types and shouldn't pull in the Prisma client/adapter (e.g. shared packages, client components).
- **`@repo/db/edge-raw`** is declared in `package.json` but has no corresponding `edge-raw.ts` file in this package — treat it as broken/dangling until someone adds the file; don't add new imports of it.

## Building

`pnpm build` here just runs `prisma generate` — there's no compiled output beyond the generated client. `check-types` isn't defined for this package (the build step doubles as validation, via `prisma generate` failing on schema errors).

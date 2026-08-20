# Convrs Engineering Audit

**Date:** 2026-08-19
**Scope:** Full repository, read-only static/code review (no code executed against production, no external systems contacted). Where a claim required running a local, side-effect-free command (`tsc --noEmit`, `next --help`), that was done; results are marked "reproduced directly." Everything else was verified by reading source.
**Not covered:** Live runtime behavior, actual database contents, production logs/metrics, dependency CVE scanning, `packages/tinybird` pipe SQL logic (datasource schemas only), the Polar/Paddle/LemonSqueezy webhook controllers in depth (Stripe was used as the representative sample).

This audit assumes familiarity with the architecture documented in the root `CLAUDE.md`, `apps/web/CLAUDE.md`, `apps/ingestion/CLAUDE.md`, and `packages/db/CLAUDE.md`. It does not re-derive that context here.

---

## Executive summary

Convrs is a fork of the open-source Dub.co monorepo, repurposed into a revenue-attribution + AI-bot-traffic analytics product. The fork is functional and the core architecture (multi-tenant Postgres/Prisma, Tinybird for event analytics, NextAuth + SAML + passkeys for auth, a five-provider billing/revenue-integration split) is coherent and mostly well-built. However, the migration from the original template was left incomplete in ways that now constitute real product bugs, not just cosmetic debt:

- **The product's headline feature — marketing attribution — doesn't work.** UTM parameters are parsed on ingestion and then explicitly discarded before being written to the analytics store (`packages/analytics/src/record-event.ts:139-143`). Every event's campaign attribution is `null`.
- **SSO is configured against a domain the product doesn't own** (`https://saml.boilercode.dev`), which will break SAML login for any enterprise customer whose IdP was set up against the real product domain, or silently misconfigure it for new ones.
- **2FA secrets are stored in plaintext** in Postgres, despite an AES-256-GCM encryption utility already existing and being used for other secrets in the same codebase.
- **`pnpm lint` / `turbo lint` is currently broken** for `apps/web` — `next lint` was removed in the installed Next.js version, and there's no ESLint config to fall back to. There is effectively no working lint gate on the app that contains almost all product code.
- **Test coverage is effectively zero** — one test file exists in the entire monorepo, covering one function. None of the code that would be most damaging to get wrong (webhook signature verification, RBAC, bot classification, currency math) has any test protection.
- A handful of hardcoded `boilercode.dev` references reach into **live, user-facing code paths** (billing-limit warning emails, TOTP issuer name, SAML entity ID) — not just leftover strings in comments.

None of this reflects an unusual level of sloppiness — it's the normal residue of forking a template quickly to ship a different product, and most of it is easy to fix. The urgent items are the ones marked Critical below; several can be fixed same-day.

**Findings by severity:** 6 Critical · 15 High · ~30 Medium · ~30 Low (exact counts depend on how sub-findings are split; see category sections).

---

## Top 10 issues to fix first

1. **UTM/campaign attribution is silently discarded end-to-end** (Critical) — `packages/analytics/src/record-event.ts:139-143`, `packages/analytics/src/schemas/event.schema.ts`. The product's core value proposition is broken for every customer, all the time, with no error.
2. **SAML SSO audience/API URL hardcoded to `boilercode.dev`** (Critical) — `apps/web/lib/jackson.ts:10,15`. Breaks or misconfigures enterprise SSO.
3. **2FA secrets stored in plaintext** (Critical) — `apps/web/lib/actions/auth/enable-two-factor.ts:35`, read back in `confirm-two-factor-auth.ts:41` and `apps/web/lib/auth/options.ts`. A DB-read exposure fully defeats every user's 2FA.
4. **`pnpm lint` / `turbo lint` is broken for `apps/web`** (Critical) — `next lint` no longer exists in Next.js 16.1.4; no ESLint config exists as a fallback. There is no working lint gate on the primary app.
5. **`Invoice.workspace` has no `onDelete` behavior** (Critical) — `packages/db/schema/invoice.prisma:19`. Deleting any workspace with invoices throws a foreign-key error; account/workspace deletion is broken for a large fraction of paying customers.
6. **Test coverage is ~0% on the highest-risk code paths** (Critical) — one test file exists repo-wide. Webhook signature verification, RBAC, bot classification, and currency math have zero regression protection.
7. **Cookieless visitor-ID salt falls back to a hardcoded public string** (High) — `apps/ingestion/src/controllers/track.ts:600-604`. If `COOKIELESS_SALT_SECRET` is unset in any environment, "cookieless" visitor IDs become trivially reversible.
8. **CORS reflects any request origin with credentials enabled** (High) — `apps/ingestion/src/index.ts:81-106`. Classic CORS misconfiguration; currently low-exploitability but a live foot-gun.
9. **`withWorkspace`'s pending-invite branch is unreachable dead code** (High) — `apps/web/lib/auth/workspace.ts:89-143`. Users with a valid pending invite get a generic 404 instead of the intended invite flow.
10. **Bot detection's IP/CIDR and referrer checks are unreachable** (High/Medium) — `packages/analytics/src/utils/detect-bot.ts:22-24`. `parseUserAgent()` never returns falsy, so the `if (ua)` branch always short-circuits — bot classification silently degrades to UA-regex-only, on the product's other headline feature.

---

## 1. Bugs and runtime/logic issues

**[Critical] UTM/campaign attribution silently dropped**
- File: `packages/analytics/src/record-event.ts:139-143`, `packages/analytics/src/schemas/event.schema.ts`, `apps/ingestion/src/controllers/track.ts:954-970`
- Problem: `track.ts`'s `normalizeTrackPayload` correctly parses `utm_source/medium/campaign/content/term` from the incoming URL. `AnalyticsEventSchema` (a plain `z.object()`, no `.passthrough()`) doesn't declare any `utm_*` fields, so Zod's default behavior strips them during `safeParse`. `record-event.ts` then hardcodes all five UTM fields to `null` in the Tinybird payload regardless of input. Confirmed directly: `grep utm packages/analytics/src/schemas/event.schema.ts` returns nothing; `record-event.ts:139-143` shows the five literal `null`s.
- Why it matters: `packages/tinybird/datasources/dub_click_events.datasource` has full `utm_*` columns ready to receive this data, and downstream attribution logic expects to read them back out. Every event is recorded with null campaign data no matter what the visitor's URL contained — this is the product's core differentiator (revenue/marketing attribution) silently not functioning.
- Fix: Add `utm_source/medium/campaign/content/term` to `AnalyticsEventSchema`; change `record-event.ts` to read them from `payload` instead of hardcoding `null`.

**[High] Attribution reconciliation cron: N+1 query, currently dormant**
- File: `apps/web/app/api/cron/social/attribution-reconcilation/route.ts:181-205`
- Problem: `for (const row of eligibleReferers) { await prisma.linkAttribution.findUnique(...) }` — one sequential DB round-trip per row, over a 48-hour window with no visible cap.
- Why it matters: This cron currently never runs (the `vercel.json` path/folder-name mismatch documented in the root CLAUDE.md means it 404s), so this is dormant — but the bug is real and will cause cron timeouts / heavy DB load the moment the path is fixed, which will likely happen at the same time someone notices this file.
- Fix: Batch-fetch all `LinkAttribution` rows for the batch's `eventId`s in one `findMany({ where: { eventId: { in: [...] } } })`, check membership via a `Set` in-memory.

**[High] Cookieless visitor-ID salt falls back to a hardcoded public string**
- File: `apps/ingestion/src/controllers/track.ts:600-604` (`getDailySalt`)
- Problem: When `COOKIELESS_SALT_SECRET` is unset, falls back to the literal string `"convrs-fallback-salt"` and only logs a warning — doesn't fail startup or the request.
- Why it matters: Any environment missing this env var silently produces cookieless visitor-ID hashes using a salt anyone can find in the source, making them trivially brute-forceable back to `(ip, ua, hostname, date)` tuples. This undermines the entire premise of "cookieless mode" as a privacy feature.
- Fix: Throw at startup (or per-request) if the env var is unset, rather than silently degrading to a public fallback.

**[Medium] Currency cache is keyed incorrectly / cache-stampede-prone**
- File: `apps/web/lib/currency/get-rate.ts:5-19`
- Problem: `getRates(base = "USD")` caches results in a single module-level variable keyed only by expiry time, not by `base`. Currently dormant (both live callers always pass `"USD"`), but the function signature invites future misuse — a call with a non-`"USD"` base would silently return USD-based rates.
- Why it matters: Wrong exchange-rate data with no error, in code that affects real revenue numbers.
- Fix: Key the cache by `base` (e.g. a `Map<string, {data, expiresAt}>`); also fix the cold-cache stampede by caching the in-flight promise, not just the resolved value.

**[Medium] `convertCurrency` silently no-ops for non-USD bases**
- File: `apps/web/lib/currency/update-rates.ts:5`, `apps/web/lib/currency/convert.ts:10-12` (referenced as `get-rate.ts` fail-safe by fork investigation — verify exact file name before fixing)
- Problem: `update-rates.ts` only ever stores `baseCurrency: "USD"` rows. If `convertCurrency(amount, from, to)` is ever called with `from !== "USD"`, the DB query returns zero rows and the fail-safe returns the unconverted amount with no error/log.
- Why it matters: A future caller converting from a non-USD currency gets a wrong number with no signal anything went wrong.
- Fix: Either store bidirectional rates, or make `convertCurrency` explicitly reject or route through USD as an intermediate when `from !== "USD"`.

**[Low] Unsafe type assertion on third-party exchange-rate API response**
- File: `apps/web/lib/currency/update-rates.ts:7,19,24`
- Problem: `const { rates } = await res.json()` has no schema validation; `rate as number` blindly asserts the shape of the frankfurter.app response.
- Why it matters: An API shape change or error body produces a confusing Prisma error deep in the upsert instead of a clear validation failure; a non-numeric value would silently corrupt `ExchangeRate` rows.
- Fix: Validate the response with a zod schema before use.

**[Low] Eager `mapbox-gl` import + non-null env assertion in a client component**
- File: `apps/web/app/app.convrs.dev/[slug]/(premium)/realtime/globe.tsx:4-7`
- Problem: `import mapboxgl from "mapbox-gl"` at module scope, then `mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!` runs at import time. No `next/dynamic` usage exists anywhere in `apps/web` (repo-wide grep returned zero matches).
- Why it matters: mapbox-gl (~200KB+ min+gzip, plus CSS) ships in this route's client bundle unconditionally; if the token env var is unset, the whole page throws at import time instead of failing gracefully inside the map component.
- Fix: Load via `next/dynamic(() => import(...), { ssr: false })`; guard the token assignment with a runtime check and fallback UI.

**[Low] Dead code duplicating live currency-conversion logic**
- File: `apps/web/lib/analytics/get-analytics.ts:1-272` (commented block) vs. live code at `478-503`
- Problem: ~270 lines of a prior `getAnalytics` implementation, including a near-duplicate of the live `convertCurrency` call pattern, sit commented out above the live function.
- Why it matters: Easy for a future edit to fix a bug in the live code while an outdated duplicate sits above it looking like a reference implementation.
- Fix: Delete; git history preserves it.

---

## 2. TypeScript migration status

**Actual JS→TS migration surface is small.** Only two real candidate files exist in the entire repository (everything else is already `.ts`/`.tsx`):

| File | Lines | Status |
|---|---|---|
| `packages/tracker/src/analytics.js` | ~1698 | **Live** — the shipped client-side tracking snippet, built to `dist/analytics.js`, served as `/script.js`. Has a `jsconfig.json` (`strict: true`) but no actual type coverage — never type-checked by any tool. |
| `packages/tracker/src/cookieless-analytics.js` | ~415 | **Dead/broken** — not referenced in `packages/tracker/package.json`'s build script, no `dist` output, no route serves it — yet `apps/web/.../script-installation-card.tsx:26` advertises `https://convrs.dev/script.cookieless.js` to users as an install option. This is a broken feature, not just a migration candidate. |

Everything else that's `.js` at the repo root or in app roots (`apps/web/next.config.js`) is intentionally JS — Next.js requires `next.config.js` at that path, and it's deliberately outside the type-checked program (`apps/web/tsconfig.json`'s `include` only globs `.ts`/`.tsx`).

**No tsconfig silently excludes `.js` files that should be checked** — `packages/tracker` has no `tsconfig.json` at all (only `jsconfig.json`, and no `check-types` script), so its two source files are never type-checked by any tooling, loosely or strictly.

**Conclusion: there is effectively no "JS→TS conversion" backlog.** The real TypeScript work in this repo is *tightening what's already TypeScript* — see the migration plan below.

---

## 3. `any` usage and unsafe type assertions

Rough counts (files containing ≥1 occurrence of `: any`, `as any`, `as unknown as`, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`; source only):

| Area | Files with hits |
|---|---|
| `apps/web` | 40 |
| `packages/*` | 19 |
| `apps/ingestion` | 5 |

No `@ts-nocheck` exists anywhere in the repo (nothing wholesale-skips checking, which is good). `@typescript-eslint/no-explicit-any` is not enforced anywhere, so this list will keep growing without a lint rule.

Most concerning occurrences:

**[Medium] `apps/web/lib/auth/options.ts:56`** — `adapter: PrismaAdapter(prisma as any)`. Masks a real, unverified incompatibility between `@prisma/client` v7's generated types and `@auth/prisma-adapter`'s expected shape — exactly where a Prisma upgrade would silently misbehave instead of failing to compile. **Fix:** narrow the cast or verify/pin adapter compatibility.

**[Medium] `apps/web/lib/auth/options.ts:419,435,458,599,603`** — four `@ts-ignore` comments around per-provider OAuth `profile` handling, plus `session as any` for `session.sessionToken` assignment. This is the core session/identity code path. **Fix:** typed per-provider profile interfaces + a `next-auth.d.ts` session augmentation instead of `@ts-ignore`.

**[Medium] `apps/web/app/api/auth/saml/token/route.ts:18`** — `oauthController.token(body as any)`. SSO token exchange body is untyped. **Fix:** type against `@boxyhq/saml-jackson`'s request type if exported, else a local interface.

**[Medium] `apps/web/app/api/dodo/webhook/route.ts:14,69`** — `environment: ... as any` and `processWebhookAsync(event: any)` on the live Dodo billing-webhook entry point, despite `apps/web/lib/dodo/types.ts` existing specifically to provide these types. **Fix:** use the existing discriminated types instead of `any`.

**[Low] `apps/web/lib/api/auth/passkey.ts:44,123`** — `credential: any`, `(pk: any) => ...` in WebAuthn credential matching. **Fix:** type against `@github/webauthn-json`'s exported types.

**[Low] `apps/web/ui/webhook/send-webhook.ts:15,31,82`, `signature.ts:2`** — `any` for outbound webhook payload/signing. Lower risk (workspace-defined payloads by design). **Fix:** generic `<T = Record<string, unknown>>` instead of `any`.

**[Low] `packages/analytics/src/upsert-customer.ts:9,40`** — `traits?: any` and a Prisma `where` clause cast to `any` on a write path, defeating Prisma's compile-time query safety.

**[Low] `packages/analytics/src/payment.ts:357,371`, `apps/ingestion/src/controllers/revenue/dodo-webhook-controller.ts:19`** — `let event: any` for parsed webhook events; pattern repeats across ~4 revenue webhook controllers.

**[Low] `packages/utils/src/constants/pricing/pricing.tsx:846`** — `getPlanFromPriceId = getPlanFromProductId as unknown as (args: {...})`, a double-cast forcing one function's signature onto another in plan-resolution code. If price IDs and product IDs aren't actually interchangeable, this masks a real logic bug. **Fix:** write `getPlanFromPriceId` as its own typed function.

**[Low, widespread] `catch (err: any)`** — repeats across billing routes (`billing/upgrade/route.ts:278,329`, `payment-methods/route.ts:78,106`) and `apps/ingestion/src/controllers/revenue/stripe-webhook-controller.ts:104,127`. Idiomatic-but-loose; recommend `catch (err: unknown)` + narrowing, enforced via lint.

**[Low] `packages/ui/src/charts/bars.tsx:129,195,233,234`, `time-series-chart.tsx:134`** — chart code has `(d: any)` accessors and `xScale as any`; the author's own comment at `bars.tsx:129` says `// swap 'any' for the real Datum type if you have it` — acknowledged debt.

**[Low] Triplicated, untyped `isReactNode` helper** — `packages/ui/src/combobox/index.tsx:512`, `filter/filter-list.tsx:1129`, `filter/filter-select.tsx:520` (plus a fourth, commented-out, at `filter-list.tsx:562`), each `(element: any)`. **Fix:** one shared, typed utility fixes both the duplication and the `any` in one pass.

---

## 4. Next.js/React issues

**[Low] Eager `mapbox-gl` import, no code-splitting anywhere in the app** — see Section 1 (`globe.tsx`). Worth calling out here too: zero `next/dynamic` usage repo-wide means no route in `apps/web` currently code-splits a heavy client dependency, which is a pattern gap beyond just this one file.

**[Low] `next.config.js` duplicate/dead config key** — `apps/web/next.config.js` sets both `turbopack: {}` and `turboPack: {}` (capital P). `turboPack` is not a valid Next.js config key and is silently ignored. No active bug today (both empty), but a landmine for whoever next adds turbopack options to the wrong key. **Fix:** delete `turboPack: {}`.

**[Low] Global `console.warn` monkeypatch in `next.config.js`** — `apps/web/next.config.js:5-16` permanently overrides `console.warn` at module load to swallow specific warning substrings (e.g. "Package mongodb can't be external"). This suppresses matching warnings for the life of the process in any context, including unrelated ones. **Fix:** scope more narrowly, or remove once the underlying warnings are resolved upstream.

**[Medium] No security headers configured** — `next.config.js` has no `headers()` block: no CSP, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, or HSTS. For an app handling auth/billing/SSO, this should be a deliberate decision (e.g. "handled at the Vercel edge"), not a silent absence. **Fix:** add a `headers()` config, or confirm and document that these are set elsewhere.

No missing-`useEffect`-dependency or missing-React-key issues were found with concrete evidence during this pass (a dedicated per-hook audit would need more budget — ~40 files in `apps/web` use `useEffect`). No raw `<img>` tags were found in the scanned directories.

---

## 5. API/backend issues

**[High] `withWorkspace`'s pending-invite branch is unreachable**
- File: `apps/web/lib/auth/workspace.ts:89-143`
- Problem: The guard at line 90 (`workspace.users.length === 0`) already returns 404 for every case where the caller isn't a member of the workspace — so the pending-invite branch at line 116, which checks `workspace.users.length === 0` again to look for a pending invite, can never execute; the first check already returned.
- Why it matters: This is a real logic bug, not a style issue. A user with a valid pending invite hitting any `withWorkspace`-wrapped route gets a generic "Workspace not found" 404 instead of the intended invite-aware response — likely breaking invite-acceptance UX for any flow that branches on that response.
- Fix: Move the "workspace doesn't exist at all" (`!workspace`) check above the membership check, and let the membership-check block fall through into the pending-invite logic instead of returning early.

**[Medium] Unbounded `findMany` on several workspace-scoped list endpoints**
- Files: `apps/web/app/api/workspaces/[idOrSlug]/tracked-events/route.ts:18-31`, `apps/web/app/api/webhooks/route.ts:14`, `.../users/route.ts`, `.../invites/route.ts`
- Problem: No `take`/`skip`/cursor, no query-param-driven pagination — every matching row for a workspace is returned.
- Why it matters: `tracked-events` in particular records essentially every unique event name/type a workspace has ever emitted; for an active workspace this grows unbounded and the endpoint gets progressively slower with no ceiling.
- Fix: Add `take` with a sane default (100–500) and cursor or offset pagination on any endpoint whose row count scales with usage.

**[Medium] Stripe webhook returns 200 on internal processing failure**
- File: `apps/ingestion/src/controllers/revenue/stripe-webhook-controller.ts:129`
- Problem: On any exception while processing an already-signature-verified webhook, the handler returns `200 { error: "Processing failed" }` ("avoid retry storms").
- Why it matters: A transient failure (DB hiccup, bug) inside payment processing makes Stripe consider the webhook delivered and never retry — the revenue/attribution event is permanently dropped with no dead-letter queue or alerting.
- Fix: Distinguish transient vs. permanent failures; return 5xx to allow Stripe's retry for transient ones, or route failures to a dead-letter store for manual reconciliation.

**[Medium] Ingestion CORS reflects the request origin with credentials enabled on every route**
- File: `apps/ingestion/src/index.ts:81-106`
- Problem: Global CORS middleware reflects `req.headers.origin` back verbatim and sets `Access-Control-Allow-Credentials: true` on every route, including the revenue-webhook endpoints that are server-to-server and don't need CORS at all.
- Why it matters: Classic CORS misconfiguration pattern. Low exploitability today (no route currently appears to rely on cookie auth on this service), but it's a foot-gun the moment a cookie-authenticated route is added here.
- Fix: Allowlist explicit origins (customer tracking domains) instead of reflecting the request origin; scope `credentials: true` only to routes that actually need it.

**[Medium] Owner lookup runs before the workspace-existence check, on the hottest endpoint in the system**
- File: `apps/ingestion/src/controllers/track.ts:671-676` vs. `:678`
- Problem: `prisma.workspaceUsers.findFirst(...)` (looking up the workspace owner, to populate `user_id` in the analytics payload) executes unconditionally, before the `if (!workspace)` null check.
- Why it matters: Runs a wasted, blocking DB round-trip even on requests with an invalid `website_id`, on the single most frequently hit endpoint in the whole system (every pageview/custom event).
- Fix: Move the owner lookup after the workspace-existence check; consider merging it into the initial workspace query via a Prisma `include`.

**[Medium] Usage-limit check is a check-then-act race**
- File: `apps/ingestion/src/controllers/track.ts:751-760` vs. `:895-900`
- Problem: `workspace.usage` is read once near the top of the request, then unconditionally incremented later. Under concurrent requests, many can each pass the stale check before any commits the increment.
- Why it matters: If `usageLimit` is meant to be a hard cap, concurrent traffic lets it overshoot silently.
- Fix: Enforce the cap atomically (conditional/guarded update) rather than read-then-write.

**[High] No idempotency key on the highest-traffic endpoint**
- File: `apps/ingestion/src/controllers/track.ts:612-944` (`trackClickController`), `packages/analytics/src/record-event.ts:112,116`
- Problem: `event_id`/`eventId` is generated fresh server-side on every call. Any client-side retry (flaky network, double-fire beacon) creates a fully separate analytics row and double-increments `workspace.usage`.
- Why it matters: Inflates both analytics numbers and usage-based billing counters — a retry storm directly costs customers money via inflated usage.
- Fix: Accept a client-generated idempotency/dedup key from the tracker snippet and use it for both the Tinybird write and the usage increment.

---

## 6. Authentication/authorization issues

**[Critical] SAML SSO configured against a domain the product doesn't own**
- File: `apps/web/lib/jackson.ts:10,15`
- Problem: `samlAudience = "https://saml.boilercode.dev"` and, in production, `externalUrl: "https://api.boilercode.dev"` — both hardcoded to an unrelated domain from the original template fork, not `convrs.dev`. Confirmed directly by reading the file.
- Why it matters: SAML assertions from customer IdPs are validated against this audience URI. If it doesn't match what's configured on the customer's IdP side, SSO breaks entirely for that customer, or — worse — if `boilercode.dev` is a domain someone else now controls, it represents an audience-validation weakness undermining assertion-scoping guarantees.
- Fix: Derive `samlAudience` and `externalUrl` from `NEXT_PUBLIC_APP_DOMAIN`/an env var, not a hardcoded foreign domain. Treat this as a migration requiring coordination with any already-configured enterprise customers' IdP settings, not a pure find-replace.

**[Critical] 2FA (TOTP) secrets stored in plaintext**
- Files: `apps/web/lib/actions/auth/enable-two-factor.ts:35` (write), `apps/web/lib/actions/auth/confirm-two-factor-auth.ts:41` and `apps/web/lib/auth/options.ts` (read)
- Problem: `User.twoFactorSecret` is written and read with no `encrypt()`/`decrypt()` call, confirmed directly. `packages/analytics/src/utils/encryption.ts` provides a working AES-256-GCM `encrypt`/`decrypt` pair and is already used to protect revenue-integration API keys (`apps/web/app/api/integrations/*/connect/route.ts`) — the pattern exists, it's just not applied here.
- Why it matters: A DB read-replica leak, backup exposure, or any read-only compromise gives an attacker every user's 2FA seed, letting them generate valid codes and fully defeat 2FA — precisely the scenario 2FA exists to protect against.
- Fix: Encrypt `twoFactorSecret` at rest with the existing helpers; decrypt only at the `getTOTPInstance` call sites. This requires a migration for existing plaintext secrets, not just a change to new writes.

**[Medium] No rate limiting on authentication-adjacent endpoints**
- Files: `apps/web/lib/auth/options.ts` (credentials `authorize`, `two-factor-challenge` provider), `apps/web/app/api/auth/reset-password/route.ts`
- Problem: `lib/social/rate-limiter.ts` exists but is only applied to outbound X/Reddit API calls in cron jobs. Login, TOTP verification (a 6-digit code), and password reset have no rate limiting.
- Why it matters: Unbounded attempts against login/2FA/reset enable credential stuffing and 2FA brute force.
- Fix: Add Upstash-Redis-backed rate limiting (already a dependency) keyed by IP+email on these three routes.

**[Medium] User-enumeration timing side channel on login**
- File: `apps/web/lib/auth/options.ts:242-263`
- Problem: The credentials provider's `authorize()` throws immediately for a nonexistent email, but performs a (deliberately slow) bcrypt compare only when the user exists — both paths return the same error message, but take different amounts of time.
- Why it matters: The timing difference is a classic enumeration side channel, letting an attacker determine which emails have accounts.
- Fix: Always run a dummy bcrypt compare (or compare against a fixed dummy hash) when the user isn't found, so both paths take comparable time.

**[Medium] `allowDangerousEmailAccountLinking: true` on Google and GitHub providers**
- File: `apps/web/lib/auth/options.ts:80-89`
- Problem: Auto-links an OAuth identity to any existing account sharing that email, with no additional ownership confirmation step.
- Why it matters: This is a documented risk of the NextAuth flag — if either provider ever surfaces an unverified/attacker-influenced email, it enables account takeover.
- Fix: Drop the flag and require an explicit "link this account" confirmation for an already-logged-in user, or confirm both providers only ever surface `email_verified: true` addresses before relying on it.

**[Low] `PrismaAdapter(prisma as any)`** — see Section 3; repeated here because it's specifically in the auth path. Resolve the underlying type mismatch rather than suppressing it.

**Verified sound — no finding:**
- `withWorkspace`'s core membership scoping correctly filters `WorkspaceUsers` by `session.user.id` (IDOR is not possible through this path, aside from the unreachable-branch bug noted separately in Section 5).
- Sampled workspace-scoped routes (`tokens/[tokenId]`, `customers/[customerId]`) correctly scope `findFirst`/`findUnique` by `workspaceId`.
- All five revenue-webhook controllers (Stripe, Polar, Paddle, Dodo, LemonSqueezy) perform genuine signature verification via library methods or `crypto.timingSafeEqual`, with no bypass path found.
- Webhook idempotency is enforced via a `(provider, externalEventId)` unique constraint on `Payment` — re-delivered webhooks correctly hit a constraint conflict rather than double-recording revenue. **Do not "improve" this into something more complex — it's correct as-is.**
- Auth cookies are `httpOnly`, `sameSite: lax`, and `secure` on Vercel.
- No hardcoded secrets/credentials found via pattern grep across `apps/web`, `apps/ingestion`, `packages/*/src`.

---

## 7. Database/Prisma issues

**[Critical] `Invoice.workspace` has no `onDelete` behavior**
- File: `packages/db/schema/invoice.prisma:19` — confirmed directly: `workspace Workspace @relation(fields: [workspaceId], references: [id])` with no `onDelete` clause, which defaults to `Restrict` in Postgres.
- Problem: Every other tenant-scoped model in this schema explicitly specifies cascade behavior; `Invoice` doesn't.
- Why it matters: Deleting a `Workspace` that has any invoices throws a foreign-key-constraint error instead of cascading — silently breaking account/workspace-deletion flows for any workspace that has ever been billed, which is presumably most paying customers.
- Fix: Add `onDelete: Cascade` (or `SetNull` if invoices must be retained for accounting/tax purposes — this is a business decision, not just a technical one) to match the rest of the schema.

**[High] `SocialSyncJob.workspaceId` has no enforced foreign key**
- File: `packages/db/schema/social-media.prisma:238-252`
- Problem: `workspaceId` is a bare `String?` with no `@relation` to `Workspace` — unlike every other `workspaceId` field in the schema.
- Why it matters: Postgres never validates it points to a real workspace, and rows are never cleaned up when a workspace is deleted, leaving orphaned rows indefinitely.
- Fix: Add `workspace Workspace? @relation(fields: [workspaceId], references: [id], onDelete: Cascade)`.

**[Medium] `SocialPost.quotedPost` self-relation has no `onDelete` behavior**
- File: `packages/db/schema/social-media.prisma:148`
- Problem: No `onDelete` specified on the self-relation.
- Why it matters: Deleting a post that other posts quote fails with a foreign-key error.
- Fix: `onDelete: SetNull`.

**[Medium] `LinkWebhook` model references a nonexistent `Link` entity**
- File: `packages/db/schema/webhook.prisma:23-30`
- Problem: References a `linkId`/`Link` relationship, but no `model Link` exists anywhere in the schema (confirmed via grep), and `LinkWebhook` has zero references anywhere in application code. Entirely orphaned from the original Dub.co link-shortener template.
- Why it matters: Dead model in the live schema — confusing to anyone reading it, and unusable as-is (any code attempting to use it would fail to compile against a nonexistent related model, or worse, silently reference the wrong thing if `Link` is ever reintroduced for something else).
- Fix: Drop the model in a migration.

**[Low] Dead commented-out model definitions in schema files**
- Files: `packages/db/schema/payment.prisma:1-34`, `packages/db/schema/stripe.prisma:1-11`
- Problem: Large blocks of superseded model definitions sit commented out directly above their live replacements.
- Fix: Delete; git history preserves them.

**[Low] Leftover authoring artifacts in `social-media.prisma`**
- File: `packages/db/schema/social-media.prisma:1-3,104,254-257`
- Problem: A "// ADD these enums + models to your schema.prisma" header comment, a "← add this line" trailing comment, and an orphaned comment describing a model that was apparently never implemented.
- Fix: Clean up; confirm whether the planned domain-discovery model is still needed before deciding.

**[Low, already known] `./edge-raw` export dangling** — `packages/db/package.json` declares it, no `edge-raw.ts` exists. Already documented in `packages/db/CLAUDE.md`.

**Not a bug — do not change:** `jackson.prisma`'s `jackson_index`/`jackson_store`/`jackson_ttl` use snake_case against Prisma's usual camelCase convention. This is required to match BoxyHQ SAML Jackson's own expected table schema.

**Positive finding:** Migrations are used properly — 39 timestamped migrations exist in `schema/migrations/`, not ad hoc `db push` against a drifted schema. No migration-drift risk observed.

---

## 8. Analytics/Tinybird/ingestion issues

(UTM attribution loss and the cookieless-salt fallback are covered in Section 1 as the two most severe items in this category — not repeated in full here.)

**[Medium] Bot detection's IP/CIDR and referrer checks are dead code**
- File: `packages/analytics/src/utils/detect-bot.ts:22-24`, `packages/analytics/src/utils/parse-user-agent.ts:30-128`
- Problem: `parseUserAgent()` always returns a defined object, never `null`/`undefined`. `detectBot`'s logic is `if (ua) { return ua.isBot || UA_BOTS.some(...) }` — since `ua` is always truthy, this branch is always taken, meaning the subsequent `REFERRER_BOTS` and `IP_BOTS`/`IP_RANGES_BOTS` checks (further down the function) are unreachable.
- Why it matters: AI-bot/crawler detection is a headline product feature. Detection is silently narrowed to UA-regex matching only — known-bot IP ranges and referrer-based signals never actually run, which will produce false negatives (bots that spoof a browser UA but come from a known bot IP range/ASN go undetected).
- Fix: Restructure so IP and referrer checks run regardless of UA match, e.g. `return ua.isBot || uaListMatch || ipMatch || refererMatch`, not an early return gated on `if (ua)`.

**[Low] Fire-and-forget Tinybird write with no durability guarantee**
- File: `packages/analytics/src/record-event.ts:203-246`
- Problem: The Tinybird write happens in an un-awaited async IIFE; the caller gets a response immediately regardless of whether the write actually succeeded.
- Why it matters: Combined with no dead-letter/retry queue, a Tinybird outage causes silent, unretried data loss for its duration (beyond whatever the internal `fetchWithRetry` covers). Likely an intentional latency tradeoff — flagged as a known reliability gap to document, not necessarily to change.
- Fix: If durability matters more than latency here, route through a queue (Upstash QStash is already a dependency) instead of fire-and-forget.

**[Low] Duplicated identity-hash logic with a subtle behavioral difference**
- Files: `packages/analytics/src/record-event.ts:253-256` (private `hashFromContext`) vs. `packages/analytics/src/utils/get-identity-hash.ts:8-13` (`getIdentityHash`)
- Problem: Both hash `${ip}-${ua}` via SHA-256, independently maintained; `get-identity-hash.ts` defaults a missing `ip` to `"127.0.0.1"`, the other doesn't.
- Why it matters: Risk of further drift between the two; a missing-IP edge case would hash differently depending on which path handled the event.
- Fix: Consolidate to one implementation.

**[Low] Encryption key loaded at module-import time with a non-null assertion, no rotation support**
- File: `packages/analytics/src/utils/encryption.ts:4`
- Problem: `const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "hex")` runs at import time. If unset or the wrong length, this throws at import — crashing any process that imports the module at cold boot, rather than surfacing a clear error at the specific call site. No key-version prefix, so rotating `ENCRYPTION_KEY` permanently orphans all previously-encrypted values (including, once Section 6's TOTP fix ships, every user's 2FA secret).
- Why it matters: Availability risk on misconfiguration, and no path to ever rotate the encryption key without a coordinated re-encryption migration.
- Fix: Lazily construct/validate the key inside `encrypt`/`decrypt`; consider a key-version prefix on ciphertext to support future rotation.

**[Low] Stray `.env` file inside package source**
- File: `packages/analytics/src/.env`
- Problem: Confirmed not tracked by git (properly gitignored), but its location inside `src/` is unusual and easy to accidentally commit later.
- Fix: Move to the package root or delete if unused; not urgent since it isn't currently leaked.

**[Low] Filename typo**
- File: `apps/ingestion/src/controllers/revenue/paddle-webhook-contoller.ts` ("contoller") — consistent with this repo's pattern of small typos surviving in shipped paths (see also the `attribution-reconcilation` cron folder). Cosmetic; rename when convenient.

**Positive finding — do not change:** Billing/webhook logic is correctly *not* duplicated between `apps/web` and `apps/ingestion` — both consume the same `packages/analytics` and `Integration`/`Payment` Prisma models. The "two distinct billing concerns" split documented in the root `CLAUDE.md` (Dodo for Convrs's own subscriptions vs. Stripe/Paddle/Polar/LemonSqueezy for customers' connected revenue) is real, intentional, and not accidental duplication.

---

## 9. Security issues

Covers items not already listed under Authentication (Section 6) or API/backend (Section 5).

**[High, confirmed twice independently] Ingestion CORS reflects the request origin with credentials enabled** — see Section 5.

**[Medium] No security headers configured** — see Section 4 (CSP, frame-ancestors, HSTS all absent from `next.config.js`).

**[Low] Dead code contains a stray secret-logging statement**
- File: `apps/ingestion/src/controllers/revenue/stripe-webhook-controller.ts:40` (inside a ~78-line commented-out duplicate at the top of the file)
- Problem: A `console.log` inside the dead block prints the raw `integration.webhookSecret` value.
- Why it matters: Currently inert since it's commented out — but it's a live footgun. If anyone "restores" this block as a reference or a quick fix without reading closely, it starts logging webhook signing secrets to server logs in plaintext. The same "large dead commented block" pattern recurs in at least `apps/ingestion/src/index.ts`, `apps/web/lib/auth/session.ts`, and `packages/analytics/src/payment.ts`.
- Fix: Delete all these dead blocks outright rather than leaving them as reference material — see Section 11.

No hardcoded secrets/credentials were found in source via pattern grep. No SQL-injection risk was found in `packages/db/edge.ts`'s raw tagged-SQL client — it uses proper parameterized tagged templates, not string concatenation. No SSRF-relevant issues were found in the scanned URL-fetching code paths within this audit's time budget (not exhaustively verified — `apps/web/lib/domains` and `lib/storage.ts` would benefit from a dedicated SSRF-focused follow-up pass given they handle user-supplied domains/URLs, but no concrete finding was confirmed here).

---

## 10. Performance issues

Covered inline in Sections 1 and 5 (N+1 query in the attribution-reconciliation cron, unbounded `findMany` list endpoints, the blocking owner-lookup-before-null-check on the hottest ingestion endpoint, eager `mapbox-gl` bundling). No additional distinct findings beyond those.

**[Medium, dormant] Sequential per-item DB writes in commented-out social sync crons**
- Files: `apps/web/app/api/cron/social/x-mentions/route.ts` (multiple `for (const tweet of tweets) { await prisma...upsert(...) }` blocks), `apps/web/app/api/cron/social/x-discovery/route.ts:209`
- Problem: Same N+1-per-item pattern as the attribution-reconciliation cron, but this code is entirely commented out (dead) — not currently executing.
- Why it matters: If/when this code is reactivated, it will reintroduce the same sequential-upsert-per-item performance profile.
- Fix: Batch upserts (`createMany`/chunked `Promise.all`) when this code is un-commented, rather than reintroducing the pattern as-is.

---

## 11. Dead/duplicated code and technical debt

**Live-code "boilercode.dev" / template-branding references** (beyond the SAML/2FA issues already covered as security findings in Sections 6):

| Severity | Location | Issue |
|---|---|---|
| High | `apps/ingestion/src/controllers/track.ts:1118` | 95%-usage-limit warning email hardcodes `https://app.boilercode.dev/${workspaceSlug}/settings/billing` — a broken link sent in real customer-facing email. |
| Medium | `apps/web/lib/auth/totp.ts:4` | TOTP issuer string is "Boilercode". Changing it later **breaks existing users' authenticator-app entries** — this needs to be handled as a breaking migration (e.g. dual-issuer support during a transition window), not a find-replace. |
| Medium | `apps/web/lib/stripe/index.ts:7,25`, `.../billing/invoices/route.ts:22` | Stripe product name/description says "Boilercode". |
| Medium | `apps/web/app/api/auth/{saml,scim}/**` (several routes) | SAML/SCIM `product` field hardcoded to "Boilercode". |
| Medium | `packages/email/src/templates/*.tsx` (verify-email, password-updated, workspace-invite, two-factor-enabled/disabled, upgrade-email, email-updated) | Nearly every transactional email says "Boilercode" in user-facing copy. |
| Medium | `packages/email/src/send-via-resend.ts:157,163,177` | Sender hardcoded as `"BoilerCode <noreply@send.boilercode.dev>"`, plus fallback support/unsubscribe URLs at boilercode.dev. |
| Low | `apps/web/ui/layout/sidebar/app-sidebar.tsx` (×5) | `sessionStorage` key literally named `boilercode_last_workspace_slug`. |
| Low | `packages/utils/src/constants/middleware.ts:3` | Default fallback string `"boilercode:"`. |
| Low | `apps/web/ui/auth/login/sso-login.tsx:40` | SSO button copy references Boilercode. |

**Recommended approach:** introduce a single `PRODUCT_NAME`/`SUPPORT_EMAIL`/`SENDER_EMAIL` constant (or env-var-driven config) and thread it through all of the above in one pass, rather than fixing each site ad hoc — except the TOTP issuer, which needs its own migration plan (see Section 6).

**[Medium] Duplicated, currency-unaware money formatter**
- File: `apps/web/lib/customers/format.ts:3-7`
- Problem: Defines a second, hardcoded-USD-only `currencyFormatter`, duplicating `packages/utils/src/functions/format-currency.ts`'s `formatCurrency(value, currency, locale)`, which already supports arbitrary currency/locale and documents its exchange-rate caveat.
- Why it matters: Any customer-money UI using the local formatter always renders `$` regardless of the customer's actual currency, silently disagreeing with the shared formatter used elsewhere.
- Fix: Delete the local formatter; use `@repo/utils`'s `formatCurrency`.

**[High] Large dead commented-out code blocks — a systemic pattern in `apps/ingestion`, not isolated to one file**
- Files: `apps/ingestion/src/index.ts:1-65`, `apps/ingestion/src/controllers/track.ts:1-571`, `apps/ingestion/src/controllers/revenue/stripe-webhook-controller.ts:1-77`
- Problem: Each of these three files carries a large, fully commented-out prior version of itself directly above the live code — not reference documentation, stale drafts.
- Why it matters: Easy to mistake for intentional reference; one such block was confirmed to contain a stray secret-logging statement (Section 9). Bloats these files substantially and makes diffs/reviews harder.
- Fix: Delete all three; git history preserves them.

**[Low] Triplicated `isReactNode` helper** — see Section 3.

**[Low] Two separately named "bots-list" files** — `apps/web/lib/middlewarre/utils/bots-list.ts` and `packages/analytics/src/utils/bots-list.ts`. Not fully verified whether these are genuinely duplicated data/logic or intentionally distinct (one for edge-middleware bot short-circuiting, one for the ingestion pipeline's classification). Given bot detection is a core feature, worth a dedicated follow-up check — drift between the two would cause inconsistent classification between the Next.js middleware and the ingestion/analytics pipeline.

**No `*.old.*`, `*.bak`, `*-copy.*`, or `*.orig` files exist anywhere in source.**

---

## 12. Build/lint/typecheck problems

**[Critical] `pnpm lint` / `turbo lint` is broken for `apps/web`**
- Reproduced directly: `apps/web/package.json`'s `"lint": "next lint"` script fails immediately. `npx next --help` in `apps/web` (Next.js 16.1.4, the installed version) lists no `lint` subcommand — it was removed. There is also no ESLint config file anywhere in `apps/web` (`.eslintrc.*`/`eslint.config.*` — none exist) to fall back to, and `eslint-config-next` is pinned to `^15.5.9` against `next@^16.1.4`.
- Why it matters: There is currently no working lint step for the app containing almost all product code, and nothing (no CLAUDE.md note, no CI) currently catches this.
- Fix: Migrate to ESLint flat config (`eslint.config.mjs`) with a Next-16-compatible version of `eslint-config-next`, per Next.js's migration guide for the `next lint` removal; add a `lint` script that invokes `eslint` directly.

**[High] `packages/ui`'s own `check-types` script currently fails**
- Reproduced directly: `pnpm --filter @repo/ui exec tsc --noEmit` → `src/date/trigger.tsx(3,10): error TS6133: 'Calendar' is declared but its value is never read.` (exit code 2).
- Why it matters: This is a shared component library consumed by both apps; `turbo run check-types` is red for this package right now.
- Fix: Remove the unused `Calendar` import (one line).

**[High] `packages/email`'s `check-types` script currently fails due to a package-boundary violation**
- Reproduced directly: `pnpm --filter @repo/email exec tsc --noEmit` fails (exit code 2) because `packages/email/src/pdf/generate-weekly-report.ts` and `weekly-report-pdf.tsx` import directly from `apps/web/lib/analytics/get-analytics.ts` via relative path — a shared package reaching back into the app layer, inverting the intended dependency direction. That file uses the `@/` path alias, which is only configured in `apps/web/tsconfig.json`, so type-checking it from `packages/email`'s context fails with `Cannot find module '@/lib/tinybird'` and similar errors, plus a `TS5097` error on an explicit-extension import in `apps/web/lib/zod/schemas/analytics.ts:17` that only surfaces under this specific cross-context compile (confirmed `apps/web`'s own `tsc --noEmit` is independently clean, so this is an artifact of the boundary violation, not a second bug).
- Why it matters: `packages/email` cannot be built, typechecked, or published independently — it silently depends on files outside its own package.
- Fix: Move the shared analytics-fetching logic into `@repo/analytics` (already a dependency of both apps), or pass pre-fetched, plainly typed data into the email/PDF generator instead of importing from `apps/web` directly.

**[Medium] `apps/web` has no `check-types` script of its own**
- Type errors are only caught incidentally via `next build`. Reproduced directly: running `tsc --noEmit -p tsconfig.json` in `apps/web` **passes cleanly (exit 0)** today — a positive finding worth preserving, though the extensive `any` usage cataloged in Section 3 means this is a lower bar than `strict: true` would set.
- Fix: Add an explicit `"check-types": "tsc --noEmit"` script so this stays enforced/visible in `turbo run check-types`, rather than being an accident of no one having broken it yet.

**[Low] Lint coverage is inconsistent across the workspace**
- Only `apps/web`, `packages/ui`, and `packages/utils` define a `"lint"` script. `apps/ingestion`, `packages/db`, `packages/analytics`, `packages/email`, `packages/tinybird`, and `packages/tracker` have none, and `apps/ingestion` has no ESLint config file at all. `turbo lint` silently no-ops for packages without the script (normal Turborepo behavior, not a crash) — but it means most of the workspace has zero lint enforcement.
- Fix: Decide deliberately which packages should be linted and add configs/scripts, rather than leaving it as an accident of which packages happened to get one when the monorepo was set up.

**Info, not a defect (verified clean, listed so it doesn't need re-checking):** `packages/analytics`, `packages/utils` `check-types` both pass cleanly; `apps/ingestion`'s `tsc --noEmit` (run directly, no script defined) also passes cleanly.

---

## 13. Test coverage and missing tests

**[Critical] Test coverage is effectively zero across the entire monorepo.** Confirmed via search for `*.test.ts`/`*.spec.ts`/`__tests__`: exactly one test file exists anywhere in the repository — `apps/web/lib/analytics/traffic-spike.test.ts` (4 cases, all covering `detectTrafficSpike`). Zero test files exist under `apps/ingestion` or any `packages/*`. There is no `.github/workflows` CI configured, so even this one test file isn't enforced on every change.

Highest-risk untested code, in priority order:

1. **[Critical]** Revenue-webhook signature verification (`apps/ingestion/src/controllers/revenue/*` — Stripe/Polar/Dodo/Paddle/LemonSqueezy). A regression here could silently drop real revenue events or accept spoofed payloads, directly corrupting billing/attribution data or creating a forgery vector.
2. **[High]** Auth/RBAC logic (`apps/web/lib/api/rbac/permissions.ts`, `resources.ts`, and `lib/actions/safe-action.ts`'s workspace-role resolution). A regression could grant a member-role user owner-level actions, or lock out legitimate users.
3. **[High]** Bot classification (`classifyBotUserAgent`, `packages/analytics/src/utils/detect-bot.ts`) — used by both the Next.js edge middleware and the ingestion `/api/ai-crawls` handler. This is core, marketed product functionality with zero regression protection (and, per Section 8, already has a live bug that tests would likely have caught).
4. **[Medium]** Currency/exchange-rate math (`update-rates.ts`, `get-rate.ts`, `packages/utils/src/functions/format-currency.ts`'s documented non-conversion behavior) — easy to accidentally "fix" into doing conversion, silently breaking downstream revenue numbers.
5. **[Medium]** Attribution/reconciliation logic (`apps/web/app/api/cron/social/*`, `packages/analytics` attribution functions) — the other core "attribute a sale to a marketing source" value proposition, with zero tests (and, per Section 1, already has a live bug).

---

## 14. Configuration/deployment/cron issues

**[Medium, already partially known] No `.env.example` exists anywhere in the repo.** Combined with `turbo.json`'s `globalDependencies: ["**/.env"]`, onboarding a new environment or engineer requires reverse-engineering ~40+ env vars from source. The env var inventory in the root `CLAUDE.md` is a ready-made starting point. **Fix:** generate a `.env.example` from that inventory.

**[Low] Every `vercel.json` cron path was cross-checked against actual route folders.** Only the already-known `attribution-reconciliation` vs. `attribution-reconcilation` mismatch exists — `update-exchange-rates`, `weekly-summary`, and `traffic-spike` all have matching route files. No other cron path bugs found.

**[Low] `.../traffic-spike/process/route.ts` and `.../weekly-summary/process/route.ts` are nested routes not referenced by any `vercel.json` entry.** Plausibly an intentional QStash fan-out pattern (the parent route enqueues to `.../process` via `lib/cron/verify-qstash.ts`) rather than orphaned code, but this wasn't independently confirmed by tracing the enqueue call site. **Recommend a quick follow-up read of `traffic-spike/route.ts` to confirm before assuming either way.**

**[Low] No `engines` field (Node version) declared anywhere.** Only `packageManager: "pnpm@8.6.10"` is pinned at root. A contributor on a mismatched Node major version gets no early, clear error.

**[Low] `turbo.json`'s pipeline doesn't declare a `test` task**, even though root `package.json`'s `"test": "turbo run test"` depends on it and `apps/web` is the only package with an actual `test` script. Not broken (Turborepo runs undeclared tasks fine), but `test` gets no `dependsOn`/caching config, unlike every other task. **Fix:** declare it explicitly for consistency.

**Informational, not a bug — confirms intentional design:** `apps/web/proxy.ts`'s middleware matcher explicitly excludes `/api/`, meaning no API route gets automatic auth/domain handling from the root middleware — every `/api/**` route is individually responsible for its own auth/RBAC check via the `lib/api/rbac` + `next-safe-action` pattern. This is consistent with the architecture documented in `apps/web/CLAUDE.md` and is very likely intentional — but it does mean a new API route that forgets to call the RBAC/auth helper has literally nothing else protecting it. Worth a lint rule or code-review checklist item, not a code change.

---

## Complete TypeScript migration plan

As established in Section 2, this is **not** primarily a file-extension conversion project — there are only two `.js` files in the repo, one of which is dead. The real "TypeScript migration" is tightening the type safety of code that's already TypeScript. Recommended phases:

**Phase 0 — Fix what's currently broken (prerequisite to everything else)**
1. Fix `packages/ui`'s failing `check-types` (unused import, one line).
2. Fix `packages/email`'s failing `check-types` by resolving the `apps/web` → `packages/email` boundary violation (Section 12) — this also unblocks being able to trust `check-types` results going forward.
3. Add a `"check-types": "tsc --noEmit"` script to `apps/web/package.json`.
4. Fix `pnpm lint` for `apps/web` (Section 12) — a working lint gate is a prerequisite for enforcing `no-explicit-any` in later phases.

**Phase 1 — Decide the fate of, then migrate, the tracker package**
5. Resolve whether `packages/tracker/src/cookieless-analytics.js` is a real feature or should be removed, along with the broken `script.cookieless.js` UI reference (`script-installation-card.tsx:26`) that currently advertises it.
6. Convert `packages/tracker/src/analytics.js` to TypeScript — it's self-contained (no monorepo imports), already has a `jsconfig.json` with `strict: true` signaling intended discipline, and is the one file in this category that's actually shipped to production. Add a real `tsconfig.json`, DOM lib types, and a `check-types` script.
7. If kept, migrate `cookieless-analytics.js` the same way; if removed, delete it and its dead build/serving references.

**Phase 2 — Reduce `any` usage in security/billing-critical paths first**
8. `apps/web/lib/auth/options.ts` — replace the `PrismaAdapter(prisma as any)` cast, the four `@ts-ignore`s around OAuth profile handling, and `session as any`, with typed per-provider profile interfaces and a `next-auth.d.ts` session augmentation.
9. `apps/web/app/api/dodo/webhook/route.ts` — use the existing `apps/web/lib/dodo/types.ts` discriminated types instead of `event: any`.
10. `apps/web/app/api/auth/saml/token/route.ts` — type the SAML token-exchange body.
11. `packages/analytics/src/upsert-customer.ts` and `payment.ts`, `apps/ingestion`'s revenue webhook controllers — replace `any` event/where-clause typing with the actual Prisma-generated or provider SDK types.

**Phase 3 — Lower-risk `any` cleanup and consolidation**
12. `packages/ui` chart components (`bars.tsx`, `time-series-chart.tsx`) — introduce a real `Datum` type per the author's own TODO comment.
13. Consolidate the triplicated `isReactNode` helper into one typed utility in `packages/ui`.
14. `apps/web/lib/api/auth/passkey.ts` — type against `@github/webauthn-json`'s exported types.
15. Repo-wide `catch (err: any)` → `catch (err: unknown)` + narrowing.

**Phase 4 — Raise the strictness floor**
16. Enable `@typescript-eslint/no-explicit-any` (as a warning first, then error) once `apps/web`'s lint is working again (Phase 0) and the above phases have reduced the count.
17. Evaluate turning on `strict: true` in `apps/web/tsconfig.json` (it currently overrides the shared `strict: true` base back to `false`, keeping only `strictNullChecks`) now that `packages/*` are already strict — this is a larger, separately-scoped effort once the `any` count is down, not a quick flip.

This plan deliberately treats "the codebase is fully TypeScript already" as the actual starting condition — the work is about safety, not syntax.

---

## Recommended remediation order

Grouped by what unblocks what, not strictly by severity (a Critical bug that's isolated and self-contained can be fixed same-day; a Critical bug requiring a migration plan takes longer):

1. **Same-day, isolated fixes:** `Invoice.workspace` cascade behavior (needs a product/business decision on Cascade vs. SetNull first, then a migration); `packages/ui` check-types unused-import fix; `next.config.js`'s duplicate `turboPack` key.
2. **This week — security, low risk to fix, high value:** SAML audience/URL hardcoding (coordinate with any live enterprise SSO customers before changing); CORS origin-reflection in `apps/ingestion`; user-enumeration timing fix; rate limiting on login/2FA/reset.
3. **This week — restore basic engineering hygiene:** Fix `apps/web` lint (unblocks everything downstream that depends on a working lint gate); fix `packages/email`'s check-types boundary violation; add `apps/web`'s missing `check-types` script; generate `.env.example`.
4. **This sprint — the two "headline feature is broken" bugs:** UTM/campaign attribution pipeline fix (schema + record-event.ts); bot-detection dead-code fix (`detect-bot.ts`). Both are self-contained code changes but deserve dedicated test coverage added alongside the fix, not just a patch.
5. **This sprint — 2FA plaintext-storage fix:** Requires an encryption migration for existing secrets, careful rollout (can't just start encrypting new writes while old ones stay plaintext without a read-compatibility path), and ideally lands together with the SAML fix since both touch identity/auth infrastructure.
6. **Next sprint — test coverage for the highest-risk paths identified in Section 13**, starting with webhook signature verification and RBAC, ideally written alongside/immediately after the fixes above so the fixes themselves are the first tests.
7. **Ongoing, lower urgency:** `withWorkspace` pending-invite branch fix; N+1 query fixes (several are currently dormant due to the cron path bug, so there's no fire-drill urgency, but fix before or alongside re-enabling those crons); the `boilercode.dev` branding sweep (batch as one PR using a shared constant, except TOTP issuer which needs its own migration plan); dead-code deletion in `apps/ingestion` (do this early since it's low-risk and removes a live footgun — the logged webhook secret in a dead block); `any`-reduction phases from the TypeScript migration plan; security headers; `Invoice`/`SocialSyncJob`/`SocialPost`/`LinkWebhook` schema fixes (bundle into one migration).

---

## Things that should NOT be changed — intentional architecture

- **The split Prisma schema across ~14 files** (`packages/db/schema/*.prisma`) and its **three client entrypoints** (`.` for the full Node client, `./edge` for a raw-SQL edge client, `./client` for types-only) — this is deliberate, documented in `packages/db/CLAUDE.md`, and each entrypoint serves a distinct runtime constraint (edge runtime can't run the full Prisma client).
- **The two-billing-systems split** — Dodo Payments for Convrs's own subscription billing vs. Stripe/Paddle/Polar/LemonSqueezy as customer-connected revenue integrations for attribution. Verified: no accidental duplication exists between `apps/web` and `apps/ingestion` here; both correctly share `packages/analytics` and the `Integration`/`Payment` models.
- **`Payment`'s `@@unique([provider, externalEventId])` constraint** as the idempotency mechanism for webhook re-delivery — this is correct, deliberate design. Do not replace it with a more complex idempotency-key scheme.
- **`jackson.prisma`'s snake_case table names** (`jackson_index`, `jackson_store`, `jackson_ttl`) — required to match BoxyHQ SAML Jackson's own expected schema, not a convention violation.
- **`apps/ingestion` mounting webhook routes with `express.raw()` before the global `express.json()` middleware** — required for signature verification to see the raw request body; do not reorder.
- **`packages/analytics` depending on `fastify` while not being a server** — it's a shared library imported by both `apps/web` and `apps/ingestion`; the fastify dependency is incidental (likely used for a schema/type utility), not evidence it should be extracted into its own service.
- **The fire-and-forget Tinybird write in `record-event.ts`** — likely an intentional latency-over-durability tradeoff for a high-volume analytics ingestion path. Flagged in Section 8 as worth *documenting* as a known reliability characteristic, not necessarily changing.
- **`apps/web`'s non-strict TypeScript (`strict: false`, `strictNullChecks: true`)** while shared `packages/*` are fully strict — this is a real gap (see the TypeScript migration plan), but flipping it in one shot without first reducing `any` usage would produce a wall of new errors with no clear priority order; treat as a deliberately staged, not skipped, piece of work.

---

## Read-only verification performed

The following claims were independently re-verified by reading the actual source (not just trusting the initial investigation) before inclusion in this report:

- `packages/db/schema/invoice.prisma` — confirmed no `onDelete` clause on the `workspace` relation.
- `apps/web/lib/jackson.ts` — confirmed `samlAudience = "https://saml.boilercode.dev"` and the production `externalUrl` fallback.
- `apps/web` lint — confirmed no ESLint config file exists, and directly ran `npx next --help` in `apps/web` to confirm Next.js 16.1.4 has no `lint` subcommand.
- `packages/analytics/src/schemas/event.schema.ts` — confirmed no `utm_*` fields declared.
- `packages/analytics/src/record-event.ts` — confirmed all five UTM fields are hardcoded to `null` at lines 139–143.
- TOTP secret handling — traced the write site (`apps/web/lib/actions/auth/enable-two-factor.ts:35`) and a read site (`confirm-two-factor-auth.ts:41`) directly; confirmed neither calls `encrypt()`/`decrypt()`, and confirmed `packages/analytics/src/utils/encryption.ts` exports a working `encrypt`/`decrypt` pair that exists but isn't used here.

All other findings in this report come from the five parallel investigations that fed it; each was instructed to verify claims by reading the actual file rather than inferring, and cross-referencing between investigations (e.g. the `boilercode.dev` SAML finding, the ingestion CORS finding, and the billing-warning-email link were each independently surfaced by more than one investigation, which increases confidence in them).

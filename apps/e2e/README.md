# apps/e2e — Playwright E2E suite

Verifies the Phase 2 audit fixes (UTM attribution, tracking idempotency, bot
detection, 2FA/encryption, workspace invites, RBAC, revenue webhook
verification) through the real running `apps/web` + `apps/ingestion`
applications, backed by real Postgres and Redis.

## Database safety

This suite runs `prisma db push` and a **full table truncate** before
seeding. `fixtures/db-safety.ts` refuses to run unless:

1. `E2E_ALLOWED_DB_HOSTS` (in `.env.e2e`) explicitly lists the DB host — no
   allowlist, no run.
2. The resolved `DATABASE_URL` is not byte-identical to, and does not share
   a host with, the real dev `DATABASE_URL` in `apps/web/.env`.
3. The database/user identifiers don't contain `prod`/`production`.

The checked-in `.env.e2e` points at a disposable Neon branch, `e2e-test`
(branched off the `production` branch of the `Convrs` Neon project —
`super-mud-92337280`), reused across runs and truncated fresh every time.
To dispose of it entirely: `neonctl branches delete e2e-test --project-id super-mud-92337280`.

Redis is the same real Upstash instance the app normally uses — idempotency
keys are scoped per test-generated `workspace.id`, so there's no collision
risk with real data, and nothing here needs Redis to be disposable the way
Postgres does.

## Timeouts

`playwright.config.ts`'s `globalTimeout: 15 * 60_000` bounds the whole run
(webServer boot + globalSetup + tests), but it does **not** protect against a
hung `globalSetup` the way its own comment implies — reproduced four times.
Playwright's `globalTimeout` is enforced by racing the running task against
a `setTimeout` (`playwright/lib/runner/taskRunner.js`,
`Promise.race([taskLoop(), ..., timeoutWatcher.promise])`). Once the timer
wins, Playwright stops *waiting* on the task and reports a timeout — but it
never actually cancels the `await globalSetup(...)` call still in flight.
That orphaned promise keeps running in the background. Normally this is
harmless because `gracefullyProcessExitDoNotHang()` force-`process.exit()`s
within 30s of the deadline regardless — but that call only happens *after*
`runAllTests()` resolves, which itself waits on the same orphaned task loop
during its teardown pass. A hang with no rejection and no closed handle is
therefore not guaranteed to unblock in bounded time. Net effect:
`globalTimeout` is a backstop for tasks that eventually resolve/reject, not
a substitute for bounding individual operations inside `globalSetup` itself.

The hang itself turned out not to be one bug at one call site. Across four
runs it stalled at two entirely different points — a `prisma.user.create()`
call with its underlying Neon socket stuck mid-connect (`Get-NetTCPConnection`
showed it parked in `Bound`, never reaching `ESTABLISHED`) in three runs, and
a dynamic `import("@repo/analytics")` that never returned in a fourth, with
no comparable socket evidence — diagnosed with temporary logging around
every `createUser()` call and the Prisma extension, plus
`DEBUG=prisma:driver-adapter:neon` to trace the adapter's own internal
query/connect events. It never reproduced once running `global-setup.ts`
standalone (`tsx`, no Playwright, no concurrent webServer/ingestion
processes) — only under the full Playwright-driven run, where the Next.js
and ingestion dev servers are also booting and opening their own connections
at the same time. That points to environment-level connection-establishment
flakiness under concurrent process startup, not a defect in one specific
line of application code — so no single call-site timeout can fully cover
it.

Two complementary, e2e-only fixes as a result, both deliberately not
touching `packages/db/index.ts` or any production code:

1. **`fixtures/db.ts`** wraps every Prisma call (via `$extends`'s
   `$allOperations`) in a `Promise.race` against a 20s local timer — catches
   the case where the stall *is* a DB call. A plain `setTimeout` doesn't
   depend on the Neon driver's own `connectionTimeoutMillis` being correct
   (which proved unreliable against the observed stall).
2. **`global-setup.ts`** additionally wraps the whole truncate+seed sequence
   in its own `Promise.race` against a 90s timer — the backstop for a stall
   that *isn't* a DB call (like the `import()` case). Either watchdog firing
   throws a clear, immediate error identifying that global setup exceeded
   its allowed duration, which propagates through Playwright's normal
   per-task `catch` handler in seconds — instead of relying on the
   15-minute outer `globalTimeout` at all, which (per above) can't be
   trusted to unblock a hang on its own.

## Running

```bash
pnpm --filter e2e install-browsers   # once
pnpm --filter e2e test               # default suite — no Tinybird required
pnpm --filter e2e test:tinybird      # UTM-attribution suite only
```

`playwright.config.ts` always spawns fresh `apps/web`/`apps/ingestion` dev
servers on dedicated ports (8899 / 3099) — it never reuses an
already-running dev server, since that server could be pointed at the real
dev database. Each spawned server gets the app's real `.env` plus the
`DATABASE_URL`/port overrides in `.env.e2e` (see `fixtures/env.ts`) — so
every other env var (OAuth, storage, email, etc.) behaves exactly like a
normal `pnpm dev` run.

## Tinybird dependency (`utm-attribution.tinybird.spec.ts`)

This is the one suite that needs a **local Tinybird instance**
(`TINYBIRDS_API_URL=http://localhost:7181`, per `apps/web/.env`) actually
running (`tb local` / the Tinybird CLI's local dev server). It's isolated
into its own Playwright project and matched only by `*.tinybird.spec.ts`, so
the default `pnpm test` run never touches it. The spec itself also does a
reachability preflight and calls `test.skip()` with a clear message if
Tinybird isn't up, rather than timing out opaquely.

Note: `revenue-webhooks.spec.ts` (the *non*-tinybird-tagged suite) still
calls the real payment pipeline, which unconditionally calls
`attemptAttribution()` — with Tinybird unreachable this adds its built-in
~2.5s retry/backoff per webhook test (it fails closed to `unattributed`,
which is what those tests assert on). That's expected latency, not a bug.

## Known testing gaps (not covered here, and why)

- **OAuth account-linking through real Google/GitHub consent.** Google
  actively detects and blocks Playwright/Selenium-style automation on its
  own login page, so this would be flaky by construction, independent of
  test quality — and there's no test-mode OAuth provider wired into this
  app to substitute. The one piece of related logic that's pure server-side
  branching — forcing a 2FA challenge before completing an OAuth-linked
  sign-in for an already-2FA-enabled account (`apps/web/lib/auth/options.ts`,
  `signIn` callback, ~line 444) — is unexercised by this suite. If it's ever
  worth covering, it's a narrow Vitest unit test calling that callback
  directly with constructed `user`/`account`/`profile` objects and a mocked
  `prisma` — deliberately **not** added here per instruction, since the ask
  was Playwright-first and this one genuinely can't be driven through the
  real app.
- **Idempotency's Redis-failure fail-open branch**
  (`redisWithTimeout.set` throwing/timing out inside `isDuplicateTrackEvent`,
  `apps/ingestion/src/controllers/track.ts`). Forcing this through the real
  running app would mean taking down the shared Upstash connection mid-run,
  which would also break every other concurrently-running test that touches
  Redis — not a reasonable Playwright scenario. Deliberately **not** added
  as a Vitest test either, per instruction; if you want it covered, it's a
  one-function test mocking the redis client's `.set` to reject and
  asserting `isDuplicateTrackEvent` returns `false` rather than throwing.
- **Registration → email verification** *is* covered end-to-end (the OTP is
  read directly from the disposable DB's `EmailVerificationToken` table
  rather than needing a real inbox) — this was originally scoped as a
  partial/gap item but turned out to be fully testable once the actual
  create-account flow was inspected (the account isn't created until OTP
  verification, and the code is a real, generated token — no email capture
  harness needed).
- **SAML/SSO-enforced-domain login** was dropped from the original plan
  after reading `options.ts`'s `signIn` callback: SSO enforcement is
  explicitly skipped when `account.provider === "credentials"`, so a
  credentials-login test against an SSO-enforced domain wouldn't exercise
  what it was meant to — testing it would need a real SAML IdP flow, out of
  scope here.

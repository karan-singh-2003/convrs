-- Deploy 2 (billing rework): enforce invariant I-12 at the database level —
-- a user may hold AT MOST ONE non-terminal Growth subscription.
-- See docs/billing-invariants.md §8.1.
--
-- Prisma's schema DSL cannot express a partial unique index, so this is a
-- hand-authored migration. It is additive and, on a clean-database replay,
-- runs before any Subscription rows exist.

CREATE UNIQUE INDEX "one_active_growth_per_user"
  ON "Subscription" ("ownerUserId")
  WHERE "planFamily" = 'growth' AND "status" NOT IN ('canceled', 'expired');

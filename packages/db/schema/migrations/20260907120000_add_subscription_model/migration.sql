-- Deploy 1 (billing rework): additive schema for Convrs's own subscription
-- billing. See docs/billing-implementation-plan.md §2.1 and
-- docs/billing-invariants.md.
--
-- 100% additive / data-safe:
--   * only DROP INDEX (two unique constraints), ADD COLUMN (all nullable or
--     defaulted), CREATE TABLE, CREATE INDEX, ADD FOREIGN KEY (on new nullable
--     columns — no existing row can violate).
--   * no DROP COLUMN / DROP TABLE / ALTER TYPE / data UPDATE / NOT NULL on
--     existing data.
--   * legacy Workspace.dodoCustomerId / dodoSubscriptionId columns are KEPT
--     (dual-write period); only their UNIQUE indexes are removed. The plain
--     Workspace_dodoCustomerId_idx / Workspace_dodoSubscriptionId_idx indexes
--     remain (created by earlier migrations from the model's @@index lines).

-- ── Remove the two legacy UNIQUE constraints (a Growth Subscription fans the
--    same dodoSubscriptionId / dodoCustomerId onto up to 30 Workspace rows) ──
DROP INDEX "Workspace_dodoCustomerId_key";
DROP INDEX "Workspace_dodoSubscriptionId_key";

-- ── User: the buyer's Dodo customer id (one per user) ──
ALTER TABLE "User" ADD COLUMN     "dodoCustomerId" TEXT;

-- ── Workspace: FK to the covering Subscription + denormalized planTier ──
ALTER TABLE "Workspace" ADD COLUMN     "planTier" TEXT,
ADD COLUMN     "subscriptionId" TEXT;

-- ── Subscription: Convrs's own subscription record (source of truth) ──
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "dodoSubscriptionId" TEXT,
    "dodoCustomerId" TEXT,
    "dodoProductId" TEXT,
    "planFamily" "PricingFamily" NOT NULL,
    "planTier" TEXT NOT NULL,
    "tierEvents" INTEGER NOT NULL,
    "billingInterval" "BillingInterval",
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'inactive',
    "maxWorkspaces" INTEGER NOT NULL,
    "workspaceCount" INTEGER NOT NULL DEFAULT 0,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "paymentFailedAt" TIMESTAMP(3),
    "lastUsageResetAt" TIMESTAMP(3),
    "pendingPlanChange" JSONB,
    "lastEventAt" TIMESTAMP(3),
    "lastWebhookId" TEXT,
    "welcomeEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- ── DodoWebhookEvent: webhook idempotency + audit ──
CREATE TABLE "DodoWebhookEvent" (
    "webhookId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "dodoSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "DodoWebhookEvent_pkey" PRIMARY KEY ("webhookId")
);

-- ── Indexes ──
CREATE UNIQUE INDEX "Subscription_dodoSubscriptionId_key" ON "Subscription"("dodoSubscriptionId");
CREATE INDEX "Subscription_ownerUserId_idx" ON "Subscription"("ownerUserId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");
CREATE INDEX "DodoWebhookEvent_dodoSubscriptionId_idx" ON "DodoWebhookEvent"("dodoSubscriptionId");
CREATE INDEX "DodoWebhookEvent_status_idx" ON "DodoWebhookEvent"("status");
CREATE INDEX "DodoWebhookEvent_receivedAt_idx" ON "DodoWebhookEvent"("receivedAt");
CREATE UNIQUE INDEX "User_dodoCustomerId_key" ON "User"("dodoCustomerId");
CREATE INDEX "Workspace_subscriptionId_idx" ON "Workspace"("subscriptionId");

-- ── Foreign keys (SET NULL on Subscription delete — never cascades to
--    workspace data; I-16) ──
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

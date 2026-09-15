-- CreateEnum
CREATE TYPE "KpiRevenueMetric" AS ENUM ('revenue', 'mrr');

-- CreateEnum
CREATE TYPE "CustomerSubscriptionStatus" AS ENUM ('active', 'trialing', 'past_due', 'paused', 'canceled');

-- CreateEnum
CREATE TYPE "SubscriptionInterval" AS ENUM ('day', 'week', 'month', 'year');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "kpiRevenueMetric" "KpiRevenueMetric" NOT NULL DEFAULT 'revenue';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingInterval" "SubscriptionInterval",
ADD COLUMN     "plan" TEXT;

-- CreateTable
CREATE TABLE "CustomerSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "provider" "RevenueProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalCustomerId" TEXT,
    "status" "CustomerSubscriptionStatus" NOT NULL DEFAULT 'active',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "interval" "SubscriptionInterval" NOT NULL DEFAULT 'month',
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "plan" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "attributionStatus" "AttributionStatus" NOT NULL DEFAULT 'pending',
    "attributedAt" TIMESTAMP(3),
    "lastAttributionAttempt" TIMESTAMP(3),
    "visitorId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerSubscription_workspaceId_idx" ON "CustomerSubscription"("workspaceId");

-- CreateIndex
CREATE INDEX "CustomerSubscription_customerId_idx" ON "CustomerSubscription"("customerId");

-- CreateIndex
CREATE INDEX "CustomerSubscription_workspaceId_status_idx" ON "CustomerSubscription"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "CustomerSubscription_workspaceId_startedAt_idx" ON "CustomerSubscription"("workspaceId", "startedAt");

-- CreateIndex
CREATE INDEX "CustomerSubscription_visitorId_idx" ON "CustomerSubscription"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSubscription_provider_externalId_key" ON "CustomerSubscription"("provider", "externalId");

-- AddForeignKey
ALTER TABLE "CustomerSubscription" ADD CONSTRAINT "CustomerSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSubscription" ADD CONSTRAINT "CustomerSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

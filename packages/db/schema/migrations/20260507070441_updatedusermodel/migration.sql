/*
  Warnings:

  - You are about to drop the column `defaultWorkspace` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `stripeCustomerId` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `stripeSubscriptionId` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `userLimit` on the `Workspace` table. All the data in the column will be lost.
  - The `billingInterval` column on the `Workspace` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `subscriptionStatus` column on the `Workspace` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `plan` column on the `Workspace` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[dodoCustomerId]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dodoSubscriptionId]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.
  - Made the column `tierEvents` on table `Workspace` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('month', 'year');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('inactive', 'trialing', 'active', 'past_due', 'canceling', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "WorkspacePlan" AS ENUM ('free', 'starter', 'basic', 'pro', 'growth', 'business', 'scale', 'pro_plus', 'enterprise', 'ultimate');

-- DropIndex
DROP INDEX "Workspace_stripeCustomerId_key";

-- DropIndex
DROP INDEX "Workspace_stripeSubscriptionId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "defaultWorkspace",
ADD COLUMN     "defaultWorkspaceId" TEXT,
ADD COLUMN     "freeTrialUsedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubscriptionId",
DROP COLUMN "userLimit",
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN     "dodoCustomerId" TEXT,
ADD COLUMN     "dodoSubscriptionId" TEXT,
DROP COLUMN "billingInterval",
ADD COLUMN     "billingInterval" "BillingInterval",
DROP COLUMN "subscriptionStatus",
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'inactive',
ALTER COLUMN "tierEvents" SET NOT NULL,
ALTER COLUMN "tierEvents" SET DEFAULT 0,
ALTER COLUMN "usageLimit" SET DEFAULT 0,
DROP COLUMN "plan",
ADD COLUMN     "plan" "WorkspacePlan" NOT NULL DEFAULT 'free';

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_dodoCustomerId_key" ON "Workspace"("dodoCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_dodoSubscriptionId_key" ON "Workspace"("dodoSubscriptionId");

-- CreateIndex
CREATE INDEX "Workspace_dodoSubscriptionId_idx" ON "Workspace"("dodoSubscriptionId");

-- CreateIndex
CREATE INDEX "Workspace_dodoCustomerId_idx" ON "Workspace"("dodoCustomerId");

-- CreateIndex
CREATE INDEX "Workspace_subscriptionStatus_idx" ON "Workspace"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "Workspace_plan_idx" ON "Workspace"("plan");

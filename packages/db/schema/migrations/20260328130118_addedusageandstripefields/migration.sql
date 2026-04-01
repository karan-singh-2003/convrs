/*
  Warnings:

  - You are about to drop the column `type` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `billingCycleStart` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `planTier` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `stripeId` on the `Workspace` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stripeCustomerId]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeSubscriptionId]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[projectToken]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Workspace_stripeId_key";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "type";

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "billingCycleStart",
DROP COLUMN "plan",
DROP COLUMN "planTier",
DROP COLUMN "stripeId",
ADD COLUMN     "billingInterval" TEXT,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "freeTrialEndDate" TIMESTAMP(3),
ADD COLUMN     "projectToken" TEXT,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT,
ADD COLUMN     "tierEvents" INTEGER,
ADD COLUMN     "usage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usageLimit" INTEGER NOT NULL DEFAULT 10000;

-- DropEnum
DROP TYPE "InvoiceType";

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_stripeCustomerId_key" ON "Workspace"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_stripeSubscriptionId_key" ON "Workspace"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_projectToken_key" ON "Workspace"("projectToken");

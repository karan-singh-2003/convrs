/*
  Warnings:

  - You are about to drop the column `clickId` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `clickedAt` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `linkId` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `partnerId` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `programId` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `projectConnectId` on the `Customer` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AttributionStatus" AS ENUM ('pending', 'attributed', 'unattributed');

-- DropIndex
DROP INDEX "Customer_country_idx";

-- DropIndex
DROP INDEX "Customer_linkId_idx";

-- DropIndex
DROP INDEX "Customer_partnerId_idx";

-- DropIndex
DROP INDEX "Customer_programId_partnerId_idx";

-- DropIndex
DROP INDEX "Customer_projectConnectId_externalId_key";

-- DropIndex
DROP INDEX "Customer_workspaceId_firstSaleAt_idx";

-- DropIndex
DROP INDEX "Customer_workspaceId_subscriptionCanceledAt_idx";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "clickId",
DROP COLUMN "clickedAt",
DROP COLUMN "linkId",
DROP COLUMN "partnerId",
DROP COLUMN "programId",
DROP COLUMN "projectConnectId",
ADD COLUMN     "attributedAt" TIMESTAMP(3),
ADD COLUMN     "attributionStatus" "AttributionStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "lastAttributionAttempt" TIMESTAMP(3),
ADD COLUMN     "visitorId" TEXT;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "stripeEventId" TEXT,
    "stripePaymentIntent" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "customerEmail" TEXT,
    "attributionStatus" "AttributionStatus" NOT NULL DEFAULT 'pending',
    "attributedAt" TIMESTAMP(3),
    "lastAttributionAttempt" TIMESTAMP(3),
    "visitorId" TEXT,
    "sessionId" TEXT,
    "tinybirdEventId" TEXT,
    "sentToTinybird" BOOLEAN NOT NULL DEFAULT false,
    "sentToTinybirdAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeSessionId_key" ON "Payment"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeEventId_key" ON "Payment"("stripeEventId");

-- CreateIndex
CREATE INDEX "Payment_workspaceId_idx" ON "Payment"("workspaceId");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_visitorId_idx" ON "Payment"("visitorId");

-- CreateIndex
CREATE INDEX "Payment_attributionStatus_idx" ON "Payment"("attributionStatus");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_attributionStatus_idx" ON "Customer"("workspaceId", "attributionStatus");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

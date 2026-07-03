/*
  Warnings:

  - You are about to drop the column `stripeEventId` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `stripePaymentIntent` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `stripeSessionId` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the `StripeIntegration` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[provider,externalSessionId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[provider,externalEventId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RevenueProvider" AS ENUM ('stripe', 'dodo', 'polar', 'lemonsqueezy', 'paddle');

-- DropForeignKey
ALTER TABLE "StripeIntegration" DROP CONSTRAINT "StripeIntegration_workspaceId_fkey";

-- DropIndex
DROP INDEX "Payment_stripeEventId_key";

-- DropIndex
DROP INDEX "Payment_stripeSessionId_key";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "stripeEventId",
DROP COLUMN "stripePaymentIntent",
DROP COLUMN "stripeSessionId",
ADD COLUMN     "externalEventId" TEXT,
ADD COLUMN     "externalPaymentId" TEXT,
ADD COLUMN     "externalSessionId" TEXT,
ADD COLUMN     "provider" "RevenueProvider" NOT NULL DEFAULT 'stripe';

-- DropTable
DROP TABLE "StripeIntegration";

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "RevenueProvider" NOT NULL,
    "apiKeyEncrypted" TEXT,
    "externalAccountId" TEXT,
    "webhookId" TEXT,
    "webhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Integration_workspaceId_idx" ON "Integration"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_workspaceId_provider_key" ON "Integration"("workspaceId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_externalSessionId_key" ON "Payment"("provider", "externalSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_externalEventId_key" ON "Payment"("provider", "externalEventId");

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

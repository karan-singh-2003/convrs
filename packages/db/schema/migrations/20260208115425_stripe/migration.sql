/*
  Warnings:

  - A unique constraint covering the columns `[stripeId]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[invoicePrefix]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `billingCycleStart` to the `Workspace` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('partnerPayout', 'domainRenewal');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('card', 'ach', 'ach_fast', 'sepa', 'acss');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "billingCycleStart" INTEGER NOT NULL,
ADD COLUMN     "invoicePrefix" TEXT,
ADD COLUMN     "paymentFailedAt" TIMESTAMP(3),
ADD COLUMN     "plan" TEXT DEFAULT 'free',
ADD COLUMN     "stripeId" TEXT,
ADD COLUMN     "userLimit" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "programId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "number" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'processing',
    "type" "InvoiceType" NOT NULL DEFAULT 'partnerPayout',
    "paymentMethod" "PaymentMethod",
    "amount" INTEGER NOT NULL DEFAULT 0,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "externalAmount" INTEGER NOT NULL DEFAULT 0,
    "receiptUrl" TEXT,
    "failedReason" TEXT,
    "registeredDomains" JSON,
    "stripeChargeMetadata" JSON,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_programId_idx" ON "Invoice"("programId");

-- CreateIndex
CREATE INDEX "Invoice_workspaceId_idx" ON "Invoice"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_stripeId_key" ON "Workspace"("stripeId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_invoicePrefix_key" ON "Workspace"("invoicePrefix");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

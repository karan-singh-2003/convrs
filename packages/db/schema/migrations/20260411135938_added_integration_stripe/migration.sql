/*
  Warnings:

  - The primary key for the `jackson_store` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `jackson_ttl` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- CreateEnum
CREATE TYPE "FunnelStepType" AS ENUM ('goal', 'page_view');

-- AlterTable
ALTER TABLE "jackson_index" ALTER COLUMN "key" SET DATA TYPE VARCHAR(1500),
ALTER COLUMN "storeKey" SET DATA TYPE VARCHAR(1500);

-- AlterTable
ALTER TABLE "jackson_store" DROP CONSTRAINT "jackson_store_pkey",
ALTER COLUMN "key" SET DATA TYPE VARCHAR(1500),
ALTER COLUMN "namespace" SET DATA TYPE VARCHAR(256),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(6),
ALTER COLUMN "modifiedAt" SET DATA TYPE TIMESTAMP(6),
ADD CONSTRAINT "PK_87b6fc1475fbd1228d2f53c6f4a" PRIMARY KEY ("key");

-- AlterTable
ALTER TABLE "jackson_ttl" DROP CONSTRAINT "jackson_ttl_pkey",
ALTER COLUMN "key" SET DATA TYPE VARCHAR(1500),
ADD CONSTRAINT "PK_7c9bcdfb4d82e873e19935ec806" PRIMARY KEY ("key");

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "avatar" TEXT,
    "externalId" TEXT,
    "stripeCustomerId" TEXT,
    "linkId" TEXT,
    "clickId" TEXT,
    "clickedAt" TIMESTAMP(3),
    "country" TEXT,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "saleAmount" BIGINT NOT NULL DEFAULT 0,
    "firstSaleAt" TIMESTAMP(3),
    "subscriptionCanceledAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,
    "projectConnectId" TEXT,
    "programId" TEXT,
    "partnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeIntegration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funnel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelStep" (
    "id" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" "FunnelStepType" NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_stripeCustomerId_key" ON "Customer"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_email_idx" ON "Customer"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_createdAt_idx" ON "Customer"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_saleAmount_idx" ON "Customer"("workspaceId", "saleAmount");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_firstSaleAt_idx" ON "Customer"("workspaceId", "firstSaleAt");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_subscriptionCanceledAt_idx" ON "Customer"("workspaceId", "subscriptionCanceledAt");

-- CreateIndex
CREATE INDEX "Customer_programId_partnerId_idx" ON "Customer"("programId", "partnerId");

-- CreateIndex
CREATE INDEX "Customer_partnerId_idx" ON "Customer"("partnerId");

-- CreateIndex
CREATE INDEX "Customer_linkId_idx" ON "Customer"("linkId");

-- CreateIndex
CREATE INDEX "Customer_country_idx" ON "Customer"("country");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_workspaceId_externalId_key" ON "Customer"("workspaceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_projectConnectId_externalId_key" ON "Customer"("projectConnectId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeIntegration_workspaceId_key" ON "StripeIntegration"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeIntegration_stripeAccountId_key" ON "StripeIntegration"("stripeAccountId");

-- CreateIndex
CREATE INDEX "Funnel_workspaceId_idx" ON "Funnel"("workspaceId");

-- CreateIndex
CREATE INDEX "FunnelStep_funnelId_idx" ON "FunnelStep"("funnelId");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelStep_funnelId_order_key" ON "FunnelStep"("funnelId", "order");

-- CreateIndex
CREATE INDEX "_jackson_index_key" ON "jackson_index"("key");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jackson_index" ADD CONSTRAINT "FK_937b040fb2592b4671cbde09e83" FOREIGN KEY ("storeKey") REFERENCES "jackson_store"("key") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "StripeIntegration" ADD CONSTRAINT "StripeIntegration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelStep" ADD CONSTRAINT "FunnelStep_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

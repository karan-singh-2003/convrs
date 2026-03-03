-- CreateEnum
CREATE TYPE "WebhookReceiver" AS ENUM ('user');

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "installationId" TEXT,
    "receiver" "WebhookReceiver" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "triggers" JSONB NOT NULL,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkWebhook" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,

    CONSTRAINT "LinkWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Webhook_workspaceId_idx" ON "Webhook"("workspaceId");

-- CreateIndex
CREATE INDEX "Webhook_installationId_idx" ON "Webhook"("installationId");

-- CreateIndex
CREATE INDEX "LinkWebhook_webhookId_idx" ON "LinkWebhook"("webhookId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkWebhook_linkId_webhookId_key" ON "LinkWebhook"("linkId", "webhookId");

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkWebhook" ADD CONSTRAINT "LinkWebhook_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

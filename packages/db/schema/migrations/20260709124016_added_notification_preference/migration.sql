-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "weeklySummary" BOOLEAN NOT NULL DEFAULT false,
    "trafficSpikes" BOOLEAN NOT NULL DEFAULT false,
    "lastWeeklySentAt" TIMESTAMP(3),
    "lastSpikeSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_workspaceId_key" ON "NotificationPreference"("workspaceId");

-- CreateIndex
CREATE INDEX "NotificationPreference_weeklySummary_idx" ON "NotificationPreference"("weeklySummary");

-- CreateIndex
CREATE INDEX "NotificationPreference_trafficSpikes_idx" ON "NotificationPreference"("trafficSpikes");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

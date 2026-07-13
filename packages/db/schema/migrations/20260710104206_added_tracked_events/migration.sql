-- CreateEnum
CREATE TYPE "TrackedEventType" AS ENUM ('goals', 'pageview', 'identify', 'revenue', 'exitlink');

-- CreateEnum
CREATE TYPE "TrackedEventTrigger" AS ENUM ('goal', 'page', 'payment', 'exitlink');

-- CreateEnum
CREATE TYPE "KpiType" AS ENUM ('revenue', 'goal');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "kpiEventName" TEXT,
ADD COLUMN     "kpiType" "KpiType" NOT NULL DEFAULT 'revenue';

-- CreateTable
CREATE TABLE "TrackedEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventType" "TrackedEventType" NOT NULL,
    "trigger" "TrackedEventTrigger",
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackedEvent_workspaceId_idx" ON "TrackedEvent"("workspaceId");

-- CreateIndex
CREATE INDEX "TrackedEvent_workspaceId_eventType_idx" ON "TrackedEvent"("workspaceId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedEvent_workspaceId_eventName_eventType_key" ON "TrackedEvent"("workspaceId", "eventName", "eventType");

-- AddForeignKey
ALTER TABLE "TrackedEvent" ADD CONSTRAINT "TrackedEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

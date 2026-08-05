-- AlterTable
ALTER TABLE "LinkAttribution" ADD COLUMN     "refererUrl" TEXT;

-- CreateIndex
CREATE INDEX "LinkAttribution_workspaceId_refererUrl_idx" ON "LinkAttribution"("workspaceId", "refererUrl");

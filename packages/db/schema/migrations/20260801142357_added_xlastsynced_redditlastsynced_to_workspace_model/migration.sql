-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "lastRedditSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastXSyncAt" TIMESTAMP(3);

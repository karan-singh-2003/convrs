/*
  Warnings:

  - You are about to drop the column `projectId` on the `RestrictedToken` table. All the data in the column will be lost.
  - Added the required column `workspaceId` to the `RestrictedToken` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "RestrictedToken" DROP CONSTRAINT "RestrictedToken_projectId_fkey";

-- DropIndex
DROP INDEX "RestrictedToken_projectId_idx";

-- AlterTable
ALTER TABLE "RestrictedToken" DROP COLUMN "projectId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "RestrictedToken_workspaceId_idx" ON "RestrictedToken"("workspaceId");

-- AddForeignKey
ALTER TABLE "RestrictedToken" ADD CONSTRAINT "RestrictedToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

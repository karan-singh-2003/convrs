/*
  Warnings:

  - You are about to drop the column `domain` on the `WorkspaceDomain` table. All the data in the column will be lost.
  - You are about to drop the column `isCustomDomain` on the `WorkspaceDomain` table. All the data in the column will be lost.
  - You are about to drop the column `usedForSocialDiscovery` on the `WorkspaceDomain` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[subdomain]` on the table `WorkspaceDomain` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `subdomain` to the `WorkspaceDomain` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `WorkspaceDomain` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProxyDomainStatus" AS ENUM ('pending', 'active', 'error');

-- DropIndex
DROP INDEX "WorkspaceDomain_workspaceId_domain_key";

-- AlterTable
ALTER TABLE "WorkspaceDomain" DROP COLUMN "domain",
DROP COLUMN "isCustomDomain",
DROP COLUMN "usedForSocialDiscovery",
ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "cnameTarget" TEXT NOT NULL DEFAULT 'proxy.convrs.dev',
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ProxyDomainStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "subdomain" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "verification" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceDomain_subdomain_key" ON "WorkspaceDomain"("subdomain");

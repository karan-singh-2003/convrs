-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "blockedHostnames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "blockedIpAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "blockedPages" TEXT[] DEFAULT ARRAY[]::TEXT[];

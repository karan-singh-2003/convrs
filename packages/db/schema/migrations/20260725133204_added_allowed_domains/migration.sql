-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "allowAllDomains" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowedHostnames" TEXT[] DEFAULT ARRAY[]::TEXT[];

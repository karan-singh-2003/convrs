-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "blockedCountries" TEXT[] DEFAULT ARRAY[]::TEXT[];

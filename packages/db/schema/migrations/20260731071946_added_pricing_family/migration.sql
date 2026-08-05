-- CreateEnum
CREATE TYPE "PricingFamily" AS ENUM ('standard', 'growth');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "planFamily" "PricingFamily" NOT NULL DEFAULT 'standard';

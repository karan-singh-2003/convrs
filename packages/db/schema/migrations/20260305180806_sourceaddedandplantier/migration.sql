-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deviceName" TEXT,
ADD COLUMN     "deviceType" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "os" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "source" TEXT;

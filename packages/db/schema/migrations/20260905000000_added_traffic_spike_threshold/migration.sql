-- AlterTable
ALTER TABLE "NotificationPreference" ALTER COLUMN "trafficSpikes" SET DEFAULT true,
ADD COLUMN     "trafficSpikeThreshold" INTEGER NOT NULL DEFAULT 100;

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED', 'CHF', 'CNY', 'JPY', 'KRW', 'HKD', 'NZD', 'NOK', 'PLN', 'CZK', 'BRL', 'IDR');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'USD';

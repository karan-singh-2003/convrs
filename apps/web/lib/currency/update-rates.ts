// lib/currency/update-rates.ts
import { prisma } from "@repo/db";

export async function updateExchangeRates() {
  const res = await fetch("https://api.frankfurter.app/latest?from=USD");
  console.log("fetched res in updateexchangerate", res)
  const { rates } = await res.json();

  await Promise.all(
    Object.entries(rates).map(([target, rate]) =>
      prisma.exchangeRate.upsert({
        where: {
          baseCurrency_targetCurrency: {
            baseCurrency: "USD",
            targetCurrency: target,
          },
        },
        update: {
          rate: rate as number,
        },
        create: {
          baseCurrency: "USD",
          targetCurrency: target,
          rate: rate as number,
        },
      })
    )
  );
}
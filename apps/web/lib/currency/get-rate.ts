// lib/currency/get-rate.ts
import { prisma } from "@repo/db";

// simple in-memory cache so you don't hit the DB on every analytics request
let cache: { data: Record<string, number>; expiresAt: number } | null = null;

export async function getRates(base = "USD") {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const rows = await prisma.exchangeRate.findMany({
    where: { baseCurrency: base },
  });

  const data = Object.fromEntries(
    rows.map((r) => [r.targetCurrency, Number(r.rate)])
  );

  cache = { data, expiresAt: Date.now() + 5 * 60_000 }; // 5 min TTL
  return data;
}
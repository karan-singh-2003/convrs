// lib/currency/get-rate.ts
import { prisma } from "@repo/db";

// simple in-memory cache so you don't hit the DB on every analytics request.
// Keyed by base currency — rates for one base must never answer a lookup for
// another.
const cache = new Map<string, { data: Record<string, number>; expiresAt: number }>();

export async function getRates(base = "USD") {
  const cached = cache.get(base);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const rows = await prisma.exchangeRate.findMany({
    where: { baseCurrency: base },
  });

  const data = Object.fromEntries(
    rows.map((r) => [r.targetCurrency, Number(r.rate)])
  );

  cache.set(base, { data, expiresAt: Date.now() + 5 * 60_000 }); // 5 min TTL
  return data;
}

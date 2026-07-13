// lib/currency/convert.ts
import { getRates } from "./get-rate";

export async function convertCurrency(
  amount: number,
  from: string,
  to: string
) {
  if (from === to) return amount;
  const rates = await getRates(from);
  const rate = rates[to];
  if (!rate) return amount; // fail-safe: don't silently corrupt data
  return amount * rate;
}
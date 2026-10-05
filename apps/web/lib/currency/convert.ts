// lib/currency/convert.ts
import { getRates } from "./get-rate";

// update-rates.ts only stores rates against USD, so any other pair is
// derived as a cross rate through USD.
const PIVOT = "USD";

export async function convertCurrency(
  amount: number,
  from: string,
  to: string
) {
  if (from === to) return amount;

  const direct = (await getRates(from))[to];
  if (direct) return amount * direct;

  const pivotRates = await getRates(PIVOT);
  const fromRate = from === PIVOT ? 1 : pivotRates[from];
  const toRate = to === PIVOT ? 1 : pivotRates[to];
  if (!fromRate || !toRate) return amount; // fail-safe: don't silently corrupt data
  return amount * (toRate / fromRate);
}

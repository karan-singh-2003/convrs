/**
 * Formats a numeric value as a currency string.
 *
 * NOTE: This only changes the displayed currency symbol — it does NOT convert
 * the numeric value between currencies. For example:
 *   formatCurrency(100, "USD") → "$100.00"
 *   formatCurrency(100, "EUR") → "€100.00"
 *   formatCurrency(100, "INR") → "₹100.00"
 *
 * If you need equivalent-value conversion (e.g. $100 → ₹8,600), you must
 * apply an exchange rate to `value` before calling this function.
 */
export function formatCurrency(
  value: number,
  currency = "USD",
  locale = "en-US",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

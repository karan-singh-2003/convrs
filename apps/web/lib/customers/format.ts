export const DEFAULT_TIMEZONE = "UTC";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

/**
 * Parses a "YYYY-MM-DD HH:mm:ss.SSS" string (no timezone) as UTC,
 * since that's how timestamps are stored/sent from the backend.
 */
export function parseAsUTC(value: string | null): Date | null {
  if (!value) return null;
  const hasTzInfo = /Z$|[+-]\d{2}:?\d{2}$/.test(value.trim());
  const isoLike = hasTzInfo ? value : `${value.trim().replace(" ", "T")}Z`;
  const parsed = new Date(isoLike);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const formatDate = (
  value: string | null,
  formatter: Intl.DateTimeFormat,
) => {
  const parsed = parseAsUTC(value);
  return parsed ? formatter.format(parsed) : "-";
};

export const formatTime = (
  value: string | null,
  formatter: Intl.DateTimeFormat,
) => {
  const parsed = parseAsUTC(value);
  return parsed ? formatter.format(parsed) : "-";
};

export const formatRelativeDays = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  const diffMs = Date.now() - parsed.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

export const formatAmount = (value: number) =>
  currencyFormatter.format((value || 0) / 100);

export function formatRevenue(revenue: number | null, currency: string | null) {
  if (!revenue) return null;
  const amount = revenue / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "$"}${amount.toFixed(2)}`;
  }
}

export function getTimeToSale(
  createdAt: string | null,
  firstSaleAt: string | null,
) {
  if (!createdAt || !firstSaleAt) return "-";
  const created = new Date(createdAt).getTime();
  const sale = new Date(firstSaleAt).getTime();
  if (Number.isNaN(created) || Number.isNaN(sale) || sale < created) return "-";
  const days = Math.floor((sale - created) / (1000 * 60 * 60 * 24));
  return `${days} day${days === 1 ? "" : "s"}`;
}
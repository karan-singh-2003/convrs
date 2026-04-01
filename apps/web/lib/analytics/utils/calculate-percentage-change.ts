/**
 * Calculate percentage change between previous and current values
 * Formula: ((current - previous) / previous) * 100
 *
 * Special cases:
 * - If previous is 0 and current > 0: return 100 (100% increase from zero)
 * - If previous is 0 and current is 0: return 0 (no change)
 * - If either value is null/undefined: return null
 */
export const calculatePercentageChange = (
  current: number | null | undefined,
  previous: number | null | undefined
): number | null => {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined
  ) {
    return null;
  }

  // Handle edge case where previous is 0
  if (previous === 0) {
    // If both are 0, no change
    if (current === 0) {
      return 0;
    }
    // If current > 0 from 0, that's a positive change
    return current > 0 ? 100 : -100;
  }

  const MAX_PERCENTAGE = 999;

  const raw = ((current - previous) / previous) * 100;
  return Math.max(
    -MAX_PERCENTAGE,
    Math.min(MAX_PERCENTAGE, Math.round(raw * 10) / 10)
  );
};

/**
 * Format percentage change for display
 * Returns string like "+5.2%" or "-3.1%"
 */
export const formatPercentageChange = (change: number | null): string => {
  if (change === null || change === undefined) return "N/A";
  if (change === 0) return "0%";

  const sign = change > 0 ? "+" : "";
  const capped = Math.abs(change) >= 999;
  return capped
    ? `${sign}999%+` // show "999%+" instead of "999900%"
    : `${sign}${change.toFixed(1)}%`;
};

/**
 * Get change direction (up, down, or neutral)
 */
export const getChangeDirection = (
  change: number | null
): "up" | "down" | "neutral" => {
  if (change === null || change === undefined) return "neutral";
  if (change > 0.5) return "up"; // More than 0.5% is considered increase
  if (change < -0.5) return "down"; // Less than -0.5% is considered decrease
  return "neutral"; // Between -0.5% and +0.5% is neutral
};

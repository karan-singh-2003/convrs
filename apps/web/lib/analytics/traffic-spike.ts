import { getAnalytics } from "./get-analytics";
import { subDays, getHours, getDay } from "date-fns";

export const DEFAULT_SPIKE_THRESHOLD = 100; // default — workspaces can override via NotificationPreference.trafficSpikeThreshold
export const SPIKE_COOLDOWN_HOURS = 6;
const BASELINE_DAYS = 14;

interface TimeseriesPoint {
  start: string;
  clicks: number;
}

export interface SpikeResult {
  isSpike: boolean;
  currentClicks: number;
  baselineMean: number;
  baselineStddev: number;
  zScore: number;
}

export async function detectTrafficSpike(
  workspaceId: string,
  threshold: number = DEFAULT_SPIKE_THRESHOLD
): Promise<SpikeResult> {
  const now = new Date();
  const start = subDays(now, BASELINE_DAYS);

  const series = (await getAnalytics({
    workspaceId,
    event: "clicks",
    groupBy: "timeseries",
    granularity: "hour",
    start: start.toISOString(),
    end: now.toISOString(),
  } as any)) as TimeseriesPoint[];

  if (series.length < 2) {
    return { isSpike: false, currentClicks: 0, baselineMean: 0, baselineStddev: 0, zScore: 0 };
  }

  const current = series[series.length - 1];
  const currentDate = new Date(current.start);
  const targetHour = getHours(currentDate);
  const targetDay = getDay(currentDate);

  // baseline = same hour-of-day + day-of-week over the trailing window, excluding current bucket
  const sameSlot = series
    .slice(0, -1)
    .filter((p) => {
      const d = new Date(p.start);
      return getHours(d) === targetHour && getDay(d) === targetDay;
    })
    .map((p) => p.clicks);

  if (sameSlot.length < 3) {
    // not enough history yet — fall back to comparing against overall recent mean
    const recentClicks = series.slice(0, -1).map((p) => p.clicks);
    const mean = recentClicks.reduce((a, b) => a + b, 0) / recentClicks.length;
    const stddev = Math.sqrt(
      recentClicks.reduce((sum, v) => sum + (v - mean) ** 2, 0) / recentClicks.length
    );
    const zScore =
      stddev > 0 ? (current.clicks - mean) / stddev : current.clicks > mean ? Infinity : 0;
    return {
      // The configured threshold is the explicit, user-facing trigger — it
      // alone decides isSpike. zScore/baseline are informational only (shown
      // in the notification email as "typical hour" context), never gating.
      isSpike: current.clicks > threshold,
      currentClicks: current.clicks,
      baselineMean: mean,
      baselineStddev: stddev,
      zScore,
    };
  }

  const mean = sameSlot.reduce((a, b) => a + b, 0) / sameSlot.length;
  const stddev = Math.sqrt(
    sameSlot.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sameSlot.length
  );
  const zScore =
    stddev > 0 ? (current.clicks - mean) / stddev : current.clicks > mean ? Infinity : 0;

  return {
    isSpike: current.clicks > threshold,
    currentClicks: current.clicks,
    baselineMean: mean,
    baselineStddev: stddev,
    zScore,
  };
}

export type SpikeGateResult =
  | { allowed: true }
  | { allowed: false; reason: "disabled" | "cooldown" };

/**
 * Pure gating logic for the toggle + cooldown checks, run BEFORE
 * detectTrafficSpike (so a disabled/cooling-down workspace never pays for
 * the analytics query). Kept separate from the route handler (side
 * effects/QStash) so this is unit-testable without a live DB or a signed
 * QStash request.
 */
export function isSpikeNotificationAllowed(
  preference: { trafficSpikes: boolean; lastSpikeSentAt: Date | null } | null | undefined,
  { cooldownHours = SPIKE_COOLDOWN_HOURS, now = new Date() }: { cooldownHours?: number; now?: Date } = {}
): SpikeGateResult {
  if (!preference?.trafficSpikes) {
    return { allowed: false, reason: "disabled" };
  }

  if (preference.lastSpikeSentAt) {
    const hoursSinceLastAlert =
      (now.getTime() - preference.lastSpikeSentAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastAlert < cooldownHours) {
      return { allowed: false, reason: "cooldown" };
    }
  }

  return { allowed: true };
}
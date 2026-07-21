import { getAnalytics } from "./get-analytics";
import { subDays, getHours, getDay } from "date-fns";

const MIN_ABSOLUTE_CLICKS = 20; // floor — ignore spikes below this regardless of ratio
const Z_SCORE_THRESHOLD = 3; // how many stddevs above baseline counts as a spike
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
  workspaceId: string
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
    const zScore = stddev > 0 ? (current.clicks - mean) / stddev : 0;
    return {
      isSpike: zScore >= Z_SCORE_THRESHOLD && current.clicks >= MIN_ABSOLUTE_CLICKS,
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
  const zScore = stddev > 0 ? (current.clicks - mean) / stddev : current.clicks > 0 ? Infinity : 0;

  return {
    isSpike: zScore >= Z_SCORE_THRESHOLD && current.clicks >= MIN_ABSOLUTE_CLICKS,
    currentClicks: current.clicks,
    baselineMean: mean,
    baselineStddev: stddev,
    zScore,
  };
}
// import { getAnalytics } from "./get-analytics";
// import { subDays } from "date-fns";

// export interface WeeklySummaryStats {
//   clicks: number;
//   revenue: number;
//   conversionRate: number;
//   bounceRate: number;
//   clicksChangePct: number | null;
//   revenueChangePct: number | null;
//   topLinks: { url: string; clicks: number }[];
//   topCountries: { country: string; clicks: number }[];
// }

// const pctChange = (current: number, previous: number): number | null => {
//   if (previous === 0) return current > 0 ? 100 : null;
//   return ((current - previous) / previous) * 100;
// };

// export async function computeWeeklySummary(
//   workspaceId: string,
//   timezone: string = "UTC"
// ): Promise<WeeklySummaryStats> {
//   const now = new Date();
//   const weekStart = subDays(now, 7);
//   const prevWeekStart = subDays(now, 14);

//   console.log("Weekstart and Prev Weekstart", weekStart.toISOString(), prevWeekStart.toISOString());
//   console.log("End data ", now.toISOString());

//   const [current, previous, topLinksRaw, topCountriesRaw] = await Promise.all([
//     getAnalytics({
//       workspaceId,
//       event: "composite",
//       groupBy: "count",
//       start: weekStart.toISOString(),
//       end: now.toISOString(),
//     } as any),
//     getAnalytics({
//       workspaceId,
//       event: "composite",
//       groupBy: "count",
//       start: prevWeekStart.toISOString(),
//       end: weekStart.toISOString(),
//     } as any),
//     getAnalytics({
//       workspaceId,
//       event: "clicks",
//       groupBy: "top_urls",
//       start: weekStart.toISOString(),
//       end: now.toISOString(),
//     } as any),
//     getAnalytics({
//       workspaceId,
//       event: "clicks",
//       groupBy: "countries",
//       start: weekStart.toISOString(),
//       end: now.toISOString(),
//     } as any),
//   ]);

//   const currentStats = Array.isArray(current) ? current[0] : current;
//   const previousStats = Array.isArray(previous) ? previous[0] : previous;

//   return {
//     clicks: currentStats?.clicks ?? 0,
//     revenue: currentStats?.revenue ?? 0,
//     conversionRate: currentStats?.conversion_rate ?? 0,
//     bounceRate: currentStats?.bounce_rate ?? 0,
//     clicksChangePct: pctChange(currentStats?.clicks ?? 0, previousStats?.clicks ?? 0),
//     revenueChangePct: pctChange(currentStats?.revenue ?? 0, previousStats?.revenue ?? 0),
//     topLinks: (topLinksRaw as any[]).slice(0, 5).map((l) => ({
//       url: l.url,
//       clicks: l.clicks,
//     })),
//     topCountries: (topCountriesRaw as any[]).slice(0, 5).map((c) => ({
//       country: c.country,
//       clicks: c.clicks,
//     })),
//   };
// }

import { getAnalytics } from "./get-analytics";
import { subDays, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export interface WeeklySummaryStats {
  clicks: number;
  revenue: number;
  conversionRate: number;
  bounceRate: number;
  clicksChangePct: number | null;
  revenueChangePct: number | null;
  topLinks: { url: string; clicks: number }[];
  topCountries: { country: string; clicks: number }[];
}

const pctChange = (current: number, previous: number): number | null => {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};

/**
 * Computes the [start, end) boundaries for "this week" and "last week"
 * aligned to calendar days in the workspace's own timezone.
 *
 * e.g. if "now" is Jul 9 in the workspace's local time:
 *   weekStart     -> Jul 3 00:00 local  (7 calendar days: 3,4,5,6,7,8,9)
 *   prevWeekStart -> Jun 26 00:00 local (the 7 days before that)
 */
function getWeekBoundaries(nowUtc: Date, timezone: string) {
  const nowLocal = toZonedTime(nowUtc, timezone);

  // start of "today" locally, then step back 6 days so today counts
  // as one of the 7 days in the window (3..9 inclusive = 7 days)
  const todayStartLocal = startOfDay(nowLocal);
  const weekStartLocal = subDays(todayStartLocal, 6);
  const prevWeekStartLocal = subDays(weekStartLocal, 7);

  return {
    weekStart: fromZonedTime(weekStartLocal, timezone),
    prevWeekStart: fromZonedTime(prevWeekStartLocal, timezone),
  };
}

export async function computeWeeklySummary(
  workspaceId: string,
  timezone: string = "UTC"
): Promise<WeeklySummaryStats> {
  const nowUtc = new Date();
  const { weekStart, prevWeekStart } = getWeekBoundaries(nowUtc, timezone);

  console.log(
    "Weekstart and Prev Weekstart",
    weekStart.toISOString(),
    prevWeekStart.toISOString(),
    "(tz:", timezone, ")"
  );
  console.log("End data ", nowUtc.toISOString());

  const [current, previous, topLinksRaw, topCountriesRaw] = await Promise.all([
    getAnalytics({
      workspaceId,
      event: "composite",
      groupBy: "count",
      start: weekStart.toISOString(),
      end: nowUtc.toISOString(),
    } as any),
    getAnalytics({
      workspaceId,
      event: "composite",
      groupBy: "count",
      start: prevWeekStart.toISOString(),
      end: weekStart.toISOString(),
    } as any),
    getAnalytics({
      workspaceId,
      event: "clicks",
      groupBy: "top_urls",
      start: weekStart.toISOString(),
      end: nowUtc.toISOString(),
    } as any),
    getAnalytics({
      workspaceId,
      event: "clicks",
      groupBy: "countries",
      start: weekStart.toISOString(),
      end: nowUtc.toISOString(),
    } as any),
  ]);

  const currentStats = Array.isArray(current) ? current[0] : current;
  const previousStats = Array.isArray(previous) ? previous[0] : previous;

  return {
    clicks: currentStats?.clicks ?? 0,
    revenue: currentStats?.revenue ?? 0,
    conversionRate: currentStats?.conversion_rate ?? 0,
    bounceRate: currentStats?.bounce_rate ?? 0,
    clicksChangePct: pctChange(currentStats?.clicks ?? 0, previousStats?.clicks ?? 0),
    revenueChangePct: pctChange(currentStats?.revenue ?? 0, previousStats?.revenue ?? 0),
    topLinks: (topLinksRaw as any[]).slice(0, 5).map((l) => ({
      url: l.url,
      clicks: l.clicks,
    })),
    topCountries: (topCountriesRaw as any[]).slice(0, 5).map((c) => ({
      country: c.country,
      clicks: c.clicks,
    })),
  };
}
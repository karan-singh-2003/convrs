// "use client";

// import { formatDateTooltip } from "./format-date-tooltip";
// import { AnalyticsResponseOptions } from "@/lib/analytics/types";
// import { editQueryString } from "@/lib/analytics/utils";
// import useWorkspace from "@/lib/swr/use-workspace";
// import { Areas, TimeSeriesChart, XAxis, YAxis } from "@repo/ui";
// import { fetcher, formatCurrency, nFormatter } from "@repo/utils";
// import { subDays } from "date-fns";
// import { useContext, useMemo } from "react";
// import useSWR from "swr";
// import { AnalyticsContext } from "./analytics-providers";
// import { formatDuration } from "./analytics-tabs";

// const DEMO_DATA = [
//   180, 230, 320, 305, 330, 290, 340, 310, 380, 360, 270, 360, 280, 270, 350,
//   370, 350, 340, 300,
// ]
//   .reverse()
//   .map((value, index) => ({
//     date: subDays(new Date(), index),
//     values: {
//       clicks: value,
//       revenue: value * 19,
//       leads: value,
//       sales: value,
//       saleAmount: value * 19,
//       conversion_rate: Math.min(100, Math.round((value / 4) * 10) / 10),
//       bounce_rate: Math.min(100, 60 - Math.round(value / 20)),
//       avg_session_duration: 60 + Math.round(value / 3),
//       new_visitors: Math.round(value * 0.8),
//       returning_visitors: Math.round(value * 0.2),
//       new_revenue: value * 19,
//       refund_amount: Math.round(value * 19 * 0.05),
//       revenue_per_visitor: Math.round(((value * 19) / value) * 100) / 100,
//     },
//   }))
//   .reverse();

// function lowercaseAmPm(value: string) {
//   return value.replace(/\bAM\b/g, "am").replace(/\bPM\b/g, "pm");
// }

// const RATE_METRICS = new Set(["conversion_rate", "bounce_rate"]);
// const DURATION_METRICS = new Set(["avg_session_duration"]);

// export function AnalyticsAreaChart({
//   resource,
//   demo,
// }: {
//   resource: Exclude<AnalyticsResponseOptions, "live_visitors">;
//   demo?: boolean;
// }) {
//   const { createdAt: workspaceCreatedAt, currency = "USD" } = useWorkspace();

//   const dataAvailableFrom = [workspaceCreatedAt]
//     .filter(Boolean)
//     .reduce(
//       (earliest, current) =>
//         !earliest || (current && new Date(current) < new Date(earliest))
//           ? current
//           : earliest,
//       null
//     ) as Date;

//   const {
//     baseApiPath,
//     queryString,
//     start,
//     end,
//     interval,
//     kpiType,
//     kpiLabel,
//   } = useContext(AnalyticsContext);

//   const { data: response, isLoading } = useSWR<{
//     data: Array<{
//       start: string;
//       clicks: number;
//       revenue: number;
//       leads: number;
//       sales: number;
//       saleAmount: number;
//       conversion_rate: number;
//       bounce_rate: number;
//       avg_session_duration: number;
//       new_visitors: number;
//       returning_visitors: number;
//       new_revenue: number;
//       refund_amount: number;
//       revenue_per_visitor: number;
//     }>;
//   }>(
//     !demo &&
//     `${baseApiPath}?${editQueryString(queryString, {
//       groupBy: "timeseries",
//       event: resource,
//     })}`,
//     fetcher
//   );
//   console.log("Data", response)
//   const chartData = useMemo(
//     () =>
//       demo
//         ? DEMO_DATA
//         : response?.data && Array.isArray(response.data)
//           ? response.data.map(
//             ({
//               start,
//               clicks,
//               revenue,
//               leads,
//               sales,
//               saleAmount,
//               conversion_rate,
//               bounce_rate,
//               avg_session_duration,
//               new_visitors,
//               returning_visitors,
//               new_revenue,
//               refund_amount,
//               revenue_per_visitor,
//             }) => ({
//               date: new Date(start),
//               values: {
//                 clicks,
//                 revenue,
//                 leads,
//                 sales,
//                 saleAmount,
//                 conversion_rate,
//                 bounce_rate,
//                 avg_session_duration,
//                 new_visitors,
//                 returning_visitors,
//                 new_revenue,
//                 refund_amount,
//                 revenue_per_visitor,
//               },
//             })
//           )
//           : null,
//     [response, demo]
//   );

//   const safeChartData = useMemo(
//     () =>
//       (chartData ?? []).filter(
//         (item) => item.date instanceof Date && !Number.isNaN(item.date.getTime())
//       ),
//     [chartData]
//   );

//   const series = [
//     {
//       id: "clicks",
//       valueAccessor: (d) => d.values.clicks,
//       isActive: resource === "clicks",
//       colorClassName: "text-[#3B82F6]", // Blue
//     },
//     {
//       id: "revenue",
//       valueAccessor: (d) => d.values.revenue,
//       isActive: resource === "revenue",
//       colorClassName: "text-[#10B981]", // Emerald
//     },
//     {
//       id: "conversion_rate",
//       valueAccessor: (d) => d.values.conversion_rate,
//       isActive: resource === "conversion_rate",
//       colorClassName: "text-[#A855F7]", // Purple
//     },
//     {
//       id: "bounce_rate",
//       valueAccessor: (d) => d.values.bounce_rate,
//       isActive: resource === "bounce_rate",
//       colorClassName: "text-[#EF4444]", // Red
//     },
//     {
//       id: "avg_session_duration",
//       valueAccessor: (d) => d.values.avg_session_duration,
//       isActive: resource === "avg_session_duration",
//       colorClassName: "text-[#F59E0B]", // Amber
//     },
//     {
//       id: "revenue_per_visitor",
//       valueAccessor: (d) => d.values.revenue_per_visitor,
//       isActive: resource === "revenue_per_visitor",
//       colorClassName: "text-[#14B8A6]", // Teal
//     },
//   ];

//   const activeSeries = series.find(({ id }) => id === resource);

//   const tooltipLabel =
//     resource === "clicks" ? "Visitors"
//       : resource === "revenue" ? (kpiType === "goal" ? (kpiLabel ?? "Goal") : "Revenue")
//         : resource === "conversion_rate" ? "Conversion"
//           : resource === "bounce_rate" ? "Bounce Rate"
//             : resource === "revenue_per_visitor" ? "Revenue/visitor"
//               : "Avg. Session";

//   const formatValue = (val: number) => {
//     if (resource === "revenue" || resource === "revenue_per_visitor") {
//       return resource === "revenue" && kpiType === "goal" ? nFormatter(val) : formatCurrency(val, currency);
//     }
//     if (RATE_METRICS.has(resource)) return `${nFormatter(val)}%`;
//     if (DURATION_METRICS.has(resource)) return formatDuration(val);
//     return nFormatter(val);
//   };

//   const showInitialLoader = !demo && isLoading && !response;
//   const hasChartData = safeChartData.length > 0;

//   return (
//     <div className="flex h-full w-full items-center justify-center">
//       {showInitialLoader ? (
//         <div className="w-full h-[464px] bg-bg-card space-y-2" />
//       ) : !hasChartData ? (
//         <p className="text-sm font-default text-neutral-500">No analytics data yet.</p>
//       ) : (
//         <TimeSeriesChart
//           key={queryString + resource}
//           data={safeChartData}
//           series={series}
//           defaultTooltipIndex={demo ? DEMO_DATA.length - 2 : undefined}
//           tooltipClassName="p-0 px-6 bg-bg-default"
//           tooltipContent={(d) => {
//             const dateLabel = lowercaseAmPm(
//               formatDateTooltip(d.date, { interval, start, end, dataAvailableFrom })
//             );

//             // --- CLICKS: fully detailed ---
//             if (resource === "clicks") {
//               const netRevenue = (d.values.new_revenue ?? 0) - (d.values.refund_amount ?? 0);
//               const isGoal = kpiType === "goal";
//               return (
//                 <div className="w-[250px] sm:w-[260px] space-y-2 px-2 py-3 font-alexandria">
//                   <p className="border-b border-border-subtle pb-1 text-[12px] font-medium text-content-subtle">
//                     {dateLabel}
//                   </p>

//                   <div className="space-y-1 border-b border-border-subtle pb-2">
//                     <div className="flex items-center justify-between text-sm">
//                       <span className="font-medium text-content-subtle">Visitors</span>
//                       <span className="font-medium text-content-default">
//                         {nFormatter(
//                           (d.values.new_visitors ?? 0) +
//                           (d.values.returning_visitors ?? 0)
//                         )}
//                       </span>
//                     </div>

//                     <p className="text-[13px] text-content-subtle">
//                       {nFormatter(d.values.new_visitors ?? 0)} New and{" "}
//                       {nFormatter(d.values.returning_visitors ?? 0)} returning
//                     </p>
//                   </div>

//                   <div className="space-y-1 border-b border-border-subtle pb-2">
//                     <div className="flex items-center justify-between text-sm">
//                       <span className="font-medium text-content-subtle">
//                         {isGoal ? (kpiLabel ?? "Goal") : "Revenue"}
//                       </span>

//                       <span className="font-medium text-content-default">
//                         {isGoal
//                           ? nFormatter(d.values.revenue ?? 0)
//                           : formatCurrency(netRevenue, currency)}
//                       </span>
//                     </div>

//                     {!isGoal && (
//                       <p className="text-xs text-content-subtle">
//                         {formatCurrency(d.values.new_revenue ?? 0, currency)} New and{" "}
//                         {formatCurrency(d.values.refund_amount ?? 0, currency)} refunds
//                       </p>
//                     )}
//                   </div>

//                   <div className="flex items-center justify-between text-sm">
//                     <span className="font-medium text-content-subtle">
//                       Conversion rate
//                     </span>

//                     <span className="font-medium text-content-default">
//                       {nFormatter(d.values.conversion_rate ?? 0)}%
//                     </span>
//                   </div>

//                   <div className="flex items-center justify-between text-sm">
//                     <span className="font-medium text-content-subtle">
//                       Revenue/visitor
//                     </span>

//                     <span className="font-medium text-content-default">
//                       {formatCurrency(d.values.revenue_per_visitor ?? 0, currency)}
//                     </span>
//                   </div>
//                 </div>
//               );
//             }

//             // --- REVENUE: partial detail ---
//             if (resource === "revenue") {
//               const netRevenue = (d.values.new_revenue ?? 0) - (d.values.refund_amount ?? 0);
//               const isGoal = kpiType === "goal";
//               return (
//                 <div className="w-[210px] sm:w-[220px] space-y-2 px-2 py-3 font-alexandria">
//                   <p className="border-b border-border-subtle pb-1 text-[12px] font-medium text-content-subtle">
//                     {dateLabel}
//                   </p>

//                   <div className="space-y-1 border-b border-border-subtle pb-2">
//                     <div className="flex items-center justify-between text-sm">
//                       <span className="font-medium text-content-subtle">
//                         {isGoal ? (kpiLabel ?? "Goal") : "Revenue"}
//                       </span>

//                       <span className="font-medium text-content-default">
//                         {isGoal
//                           ? nFormatter(d.values.revenue ?? 0)
//                           : formatCurrency(netRevenue, currency)}
//                       </span>
//                     </div>

//                     {!isGoal && (
//                       <p className="text-xs text-content-subtle">
//                         {formatCurrency(d.values.new_revenue ?? 0, currency)} New and{" "}
//                         {formatCurrency(d.values.refund_amount ?? 0, currency)} refunds
//                       </p>
//                     )}
//                   </div>

//                   {!isGoal && (
//                     <div className="flex items-center justify-between text-sm">
//                       <span className="font-medium text-content-subtle">
//                         Revenue/visitor
//                       </span>

//                       <span className="font-medium text-content-default">
//                         {formatCurrency(d.values.revenue_per_visitor ?? 0, currency)}
//                       </span>
//                     </div>
//                   )}
//                 </div>
//               );
//             }

//             // --- everything else: simple, with clicks as context ---
//             return (
//               <div className="w-[190px] py-3 space-y-2">
//                 <p className="md:text-[13px] pb-1 border-b border-border-subtle text-[12px] font-alexandria font-normal text-content-subtle">
//                   {dateLabel}
//                 </p>
//                 <div className="text-sm pt-1 space-y-1">
//                   <div className="flex items-center justify-between gap-2">
//                     <p className="font-alexandria font-normal text-sm md:text-[16px] text-content-default">
//                       {tooltipLabel}
//                     </p>
//                     <h1 className="font-alexandria text-sm md:text-[16px] font-medium text-content-default">
//                       {formatValue(activeSeries?.valueAccessor(d) ?? 0)}
//                     </h1>
//                   </div>
//                   <p className="text-[13px] font-alexandria text-content-subtle">
//                     {nFormatter(d.values.clicks ?? 0)} visitors this period
//                   </p>
//                 </div>
//               </div>
//             );
//           }}
//         >

//           <XAxis
//             tickFormat={(d) => lowercaseAmPm(formatDateTooltip(d, { interval, start, end, dataAvailableFrom }))}
//           />
//           <YAxis showGridLines tickFormat={(val) => formatValue(val)} />
//           <Areas
//             showLatestValueCircle={false}
//             seriesStyles={series.map(({ id }) => ({ id, areaFill: "currentColor", areaOpacity: 0.12, lineStroke: "currentColor" }))}
//           />
//         </TimeSeriesChart>
//       )}
//     </div>
//   );
// }

"use client";

import { formatDateTooltip } from "./format-date-tooltip";
import { AnalyticsResponseOptions } from "@/lib/analytics/types";
import { editQueryString } from "@/lib/analytics/utils";
import useWorkspace from "@/lib/swr/use-workspace";
import { Areas, TimeSeriesChart, XAxis, YAxis, Bars } from "@repo/ui";
import { fetcher, formatCurrency, nFormatter } from "@repo/utils";
import { subDays } from "date-fns";
import { useContext, useMemo } from "react";
import useSWR from "swr";
import { useParams } from "next/navigation";
import { AnalyticsContext } from "./analytics-providers";
import { formatDuration } from "./analytics-tabs";
import { useSocialActivityModal } from "@/ui/modals/use-social-activity-modal";

const DEMO_DATA = [
  180, 230, 320, 305, 330, 290, 340, 310, 380, 360, 270, 360, 280, 270, 350,
  370, 350, 340, 300,
]
  .reverse()
  .map((value, index) => ({
    date: subDays(new Date(), index),
    values: {
      clicks: value,
      revenue: value * 19,
      leads: value,
      sales: value,
      saleAmount: value * 19,
      conversion_rate: Math.min(100, Math.round((value / 4) * 10) / 10),
      bounce_rate: Math.min(100, 60 - Math.round(value / 20)),
      avg_session_duration: 60 + Math.round(value / 3),
      new_visitors: Math.round(value * 0.8),
      returning_visitors: Math.round(value * 0.2),
      new_revenue: value * 19,
      refund_amount: Math.round(value * 19 * 0.05),
      revenue_per_visitor: Math.round(((value * 19) / value) * 100) / 100,
    },
  }))
  .reverse();

function lowercaseAmPm(value: string) {
  return value.replace(/\bAM\b/g, "am").replace(/\bPM\b/g, "pm");
}

// Must produce the same "YYYY-MM-DD" key as the backend's
// getLocalDateKey() in /api/[slug]/social/activity-timeline.
function getLocalDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getProfileUrl(platform: "x" | "reddit", handle: string): string {
  return platform === "reddit"
    ? `https://reddit.com/user/${handle}`
    : `https://x.com/${handle}`;
}

const RATE_METRICS = new Set(["conversion_rate", "bounce_rate"]);
const DURATION_METRICS = new Set(["avg_session_duration"]);

type ActivityPreviewItem = {
  kind: "attribution" | "mention";
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  platform: "x" | "reddit";
  content: string | null;
  likeCount: number;
};

type ActivityDayRow = {
  date: string; // "YYYY-MM-DD", local to workspace timezone
  avatars: string[];
  handles: string[];
  uniqueProfileCount: number;
  totalActivityCount: number;
  uniqueVisitorCount: number;
  previewItems: ActivityPreviewItem[];
};

export function AnalyticsAreaChart({
  resource,
  demo,
}: {
  resource: Exclude<AnalyticsResponseOptions, "live_visitors">;
  demo?: boolean;
}) {
  const {
    createdAt: workspaceCreatedAt,
    currency = "USD",
    timezone = "UTC",
  } = useWorkspace();
  const { slug } = useParams() as { slug?: string };
  const { openActivityModal, SocialActivityModal } = useSocialActivityModal();

  const dataAvailableFrom = [workspaceCreatedAt]
    .filter(Boolean)
    .reduce(
      (earliest, current) =>
        !earliest || (current && new Date(current) < new Date(earliest))
          ? current
          : earliest,
      null
    ) as Date;

  const {
    baseApiPath,
    queryString,
    start,
    end,
    interval,
    kpiType,
    kpiLabel,
  } = useContext(AnalyticsContext);

  const { data: response, isLoading } = useSWR<{
    data: Array<{
      start: string;
      clicks: number;
      revenue: number;
      leads: number;
      sales: number;
      saleAmount: number;
      conversion_rate: number;
      bounce_rate: number;
      avg_session_duration: number;
      new_visitors: number;
      returning_visitors: number;
      new_revenue: number;
      refund_amount: number;
      revenue_per_visitor: number;
    }>;
  }>(
    !demo &&
    `${baseApiPath}?${editQueryString(queryString, {
      groupBy: "timeseries",
      event: resource,
    })}`,
    fetcher
  );

  // Only fetch the social overlay when it's actually shown (clicks tab).
  const { data: activityResponse } = useSWR<{ data: ActivityDayRow[] }>(
    !demo && resource === "clicks" && slug && start && end
      ? `/api/${slug}/social/activity-timeline?start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`
      : null,
    fetcher
  );

  const activityByDate = useMemo(() => {
    const map = new Map<string, ActivityDayRow>();
    for (const row of activityResponse?.data ?? []) {
      map.set(row.date, row);
    }
    return map;
  }, [activityResponse]);

  const chartData = useMemo(
    () =>
      demo
        ? DEMO_DATA
        : response?.data && Array.isArray(response.data)
          ? response.data.map(
            ({
              start,
              clicks,
              revenue,
              leads,
              sales,
              saleAmount,
              conversion_rate,
              bounce_rate,
              avg_session_duration,
              new_visitors,
              returning_visitors,
              new_revenue,
              refund_amount,
              revenue_per_visitor,
            }) => ({
              date: new Date(start),
              values: {
                clicks,
                revenue,
                leads,
                sales,
                saleAmount,
                conversion_rate,
                bounce_rate,
                avg_session_duration,
                new_visitors,
                returning_visitors,
                new_revenue,
                refund_amount,
                revenue_per_visitor,
              },
            })
          )
          : null,
    [response, demo]
  );

  const safeChartData = useMemo(
    () =>
      (chartData ?? []).filter(
        (item) => item.date instanceof Date && !Number.isNaN(item.date.getTime())
      ),
    [chartData]
  );

  const series = [
    {
      id: "clicks",
      valueAccessor: (d) => d.values.clicks,
      isActive: resource === "clicks",
      colorClassName: "text-[#3B82F6]", // Blue
    },
    {
      id: "revenue",
      valueAccessor: (d) => d.values.revenue,
      isActive: resource === "revenue",
      colorClassName: "text-[#10B981]", // Emerald
    },
    {
      id: "conversion_rate",
      valueAccessor: (d) => d.values.conversion_rate,
      isActive: resource === "conversion_rate",
      colorClassName: "text-[#A855F7]", // Purple
    },
    {
      id: "bounce_rate",
      valueAccessor: (d) => d.values.bounce_rate,
      isActive: resource === "bounce_rate",
      colorClassName: "text-[#EF4444]", // Red
    },
    {
      id: "avg_session_duration",
      valueAccessor: (d) => d.values.avg_session_duration,
      isActive: resource === "avg_session_duration",
      colorClassName: "text-[#F59E0B]", // Amber
    },
    {
      id: "revenue_per_visitor",
      valueAccessor: (d) => d.values.revenue_per_visitor,
      isActive: resource === "revenue_per_visitor",
      colorClassName: "text-[#14B8A6]", // Teal
    },
  ];

  const activeSeries = series.find(({ id }) => id === resource);

  const tooltipLabel =
    resource === "clicks" ? "Visitors"
      : resource === "revenue" ? (kpiType === "goal" ? (kpiLabel ?? "Goal") : "Revenue")
        : resource === "conversion_rate" ? "Conversion"
          : resource === "bounce_rate" ? "Bounce Rate"
            : resource === "revenue_per_visitor" ? "Revenue/visitor"
              : "Avg. Session";

  const formatValue = (val: number) => {
    if (resource === "revenue" || resource === "revenue_per_visitor") {
      return resource === "revenue" && kpiType === "goal" ? nFormatter(val) : formatCurrency(val, currency);
    }
    if (RATE_METRICS.has(resource)) return `${nFormatter(val)}%`;
    if (DURATION_METRICS.has(resource)) return formatDuration(val);
    return nFormatter(val);
  };

  const showInitialLoader = !demo && isLoading && !response;
  const hasChartData = safeChartData.length > 0;

  const isKpiMode = kpiType === "goal";

  const revenueBarSeries = [
    {
      id: "revenueBar",
      valueAccessor: (d) => d.values.revenue ?? 0,
      isActive: true,
      // Purple to match the KPI/goal accent used elsewhere when in KPI mode,
      // emerald when it's plain revenue
      colorClassName: isKpiMode ? "text-[#A855F7]" : "text-[#10B981]",
    },
  ];

  const revenueBarLabel = isKpiMode ? (kpiLabel ?? "Goal") : "Revenue";

  const formatRevenueBarValue = (val: number) =>
    isKpiMode ? nFormatter(val) : formatCurrency(val, currency);

  const showRevenueBars =
    resource !== "revenue" &&
    safeChartData.some((d) => (d.values.revenue ?? 0) > 0);
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {showInitialLoader ? (
        <div className="w-full h-[464px] bg-bg-card space-y-2" />
      ) : !hasChartData ? (
        <p className="text-sm font-default text-neutral-500">No analytics data yet.</p>
      ) : (
        <TimeSeriesChart
          key={queryString + resource}
          data={safeChartData}
          series={series}
          defaultTooltipIndex={demo ? DEMO_DATA.length - 2 : undefined}
          tooltipClassName="p-0 px-6 bg-bg-default"
          tooltipContent={(d) => {
            const dateLabel = lowercaseAmPm(
              formatDateTooltip(d.date, { interval, start, end, dataAvailableFrom })
            );

            // --- CLICKS: fully detailed, plus X/Reddit activity overlay ---
            if (resource === "clicks") {
              const netRevenue = (d.values.new_revenue ?? 0) - (d.values.refund_amount ?? 0);
              const isGoal = kpiType === "goal";

              const dateKey = getLocalDateKey(d.date, timezone);
              const activityDay = activityByDate.get(dateKey);
              const previewItems = activityDay?.previewItems.slice(0, 2) ?? [];
              const hasMoreActivity = activityDay
                ? activityDay.totalActivityCount > previewItems.length
                : false;

              return (
                <div className="w-[250px] sm:w-[260px] space-y-2 px-2 py-3 font-alexandria">
                  <p className="border-b border-border-subtle pb-1 text-[12px] font-medium text-content-subtle">
                    {dateLabel}
                  </p>

                  <div className="space-y-1 border-b border-border-subtle pb-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-content-subtle">Visitors</span>
                      <span className="font-medium text-content-default">
                        {nFormatter(
                          (d.values.new_visitors ?? 0) +
                          (d.values.returning_visitors ?? 0)
                        )}
                      </span>
                    </div>

                    <p className="text-[13px] text-content-subtle">
                      {nFormatter(d.values.new_visitors ?? 0)} New and{" "}
                      {nFormatter(d.values.returning_visitors ?? 0)} returning
                    </p>
                  </div>

                  <div className="space-y-1 border-b border-border-subtle pb-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-content-subtle">
                        {isGoal ? (kpiLabel ?? "Goal") : "Revenue"}
                      </span>

                      <span className="font-medium text-content-default">
                        {isGoal
                          ? nFormatter(d.values.revenue ?? 0)
                          : formatCurrency(netRevenue, currency)}
                      </span>
                    </div>

                    {!isGoal && (
                      <p className="text-xs text-content-subtle">
                        {formatCurrency(d.values.new_revenue ?? 0, currency)} New and{" "}
                        {formatCurrency(d.values.refund_amount ?? 0, currency)} refunds
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-content-subtle">
                      Conversion rate
                    </span>

                    <span className="font-medium text-content-default">
                      {nFormatter(d.values.conversion_rate ?? 0)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm pb-2 border-b border-border-subtle">
                    <span className="font-medium text-content-subtle">
                      Revenue/visitor
                    </span>

                    <span className="font-medium text-content-default">
                      {formatCurrency(d.values.revenue_per_visitor ?? 0, currency)}
                    </span>
                  </div>

                  {/* ── X/Reddit activity overlay ── */}
                  {activityDay && activityDay.totalActivityCount > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium text-content-subtle">
                          Social activity
                        </span>
                        <div className="flex items-center">
                          <div className="flex -space-x-2">
                            {activityDay.avatars.map((avatarUrl, i) => (
                              <button
                                key={activityDay.handles[i] ?? i}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const handle = activityDay.handles[i];
                                  if (handle) {
                                    window.open(
                                      getProfileUrl("x", handle),
                                      "_blank",
                                      "noopener,noreferrer"
                                    );
                                  }
                                }}
                                className="size-6 rounded-full border-2 border-bg-default overflow-hidden bg-bg-subtle hover:z-10 hover:scale-110 transition-transform"
                                style={{ zIndex: activityDay.avatars.length - i }}
                              >
                                <img
                                  src={avatarUrl}
                                  alt={activityDay.handles[i] ?? "profile"}
                                  className="size-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                          {activityDay.uniqueProfileCount > activityDay.avatars.length && (
                            <span className="ml-1.5 text-[11px] text-content-subtle font-medium">
                              +{activityDay.uniqueProfileCount - activityDay.avatars.length}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {previewItems.map((item, i) => (
                          <div
                            key={`${item.handle}-${i}`}
                            className="flex items-start gap-2 rounded-lg bg-bg-subtle/50 px-2 py-1.5"
                          >
                            <img
                              src={item.avatarUrl ?? undefined}
                              alt={item.handle}
                              className="size-5 rounded-full shrink-0 mt-0.5 bg-bg-subtle"
                            />
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(
                                    getProfileUrl(item.platform, item.handle),
                                    "_blank",
                                    "noopener,noreferrer"
                                  );
                                }}
                                className="text-[12px] font-medium text-content-default hover:underline"
                              >
                                {item.displayName || `@${item.handle}`}
                              </button>
                              {/* max two lines via line-clamp-2 */}
                              <p className="text-[12px] text-content-subtle line-clamp-2">
                                {item.content ?? "Traffic from bio link"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {hasMoreActivity && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openActivityModal(dateKey, dateLabel);
                          }}
                          className="w-full text-center text-[12px] font-medium text-content-default rounded-full bg-bg-subtle py-1.5 hover:bg-bg-emphasis transition-colors"
                        >
                          View all
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // --- REVENUE: partial detail ---
            if (resource === "revenue") {
              const netRevenue = (d.values.new_revenue ?? 0) - (d.values.refund_amount ?? 0);
              const isGoal = kpiType === "goal";
              return (
                <div className="w-[210px] sm:w-[220px] space-y-2 px-2 py-3 font-alexandria">
                  <p className="border-b border-border-subtle pb-1 text-[12px] font-medium text-content-subtle">
                    {dateLabel}
                  </p>

                  <div className="space-y-1 border-b border-border-subtle pb-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-content-subtle">
                        {isGoal ? (kpiLabel ?? "Goal") : "Revenue"}
                      </span>

                      <span className="font-medium text-content-default">
                        {isGoal
                          ? nFormatter(d.values.revenue ?? 0)
                          : formatCurrency(netRevenue, currency)}
                      </span>
                    </div>

                    {!isGoal && (
                      <p className="text-xs text-content-subtle">
                        {formatCurrency(d.values.new_revenue ?? 0, currency)} New and{" "}
                        {formatCurrency(d.values.refund_amount ?? 0, currency)} refunds
                      </p>
                    )}
                  </div>

                  {!isGoal && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-content-subtle">
                        Revenue/visitor
                      </span>

                      <span className="font-medium text-content-default">
                        {formatCurrency(d.values.revenue_per_visitor ?? 0, currency)}
                      </span>
                    </div>
                  )}
                </div>
              );
            }

            // --- everything else: simple, with clicks as context ---
            return (
              <div className="w-[190px] py-3 space-y-2">
                <p className="md:text-[13px] pb-1 border-b border-border-subtle text-[12px] font-alexandria font-normal text-content-subtle">
                  {dateLabel}
                </p>
                <div className="text-sm pt-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-alexandria font-normal text-sm md:text-[16px] text-content-default">
                      {tooltipLabel}
                    </p>
                    <h1 className="font-alexandria text-sm md:text-[16px] font-medium text-content-default">
                      {formatValue(activeSeries?.valueAccessor(d) ?? 0)}
                    </h1>
                  </div>
                  <p className="text-[13px] font-alexandria text-content-subtle">
                    {nFormatter(d.values.clicks ?? 0)} visitors this period
                  </p>
                </div>
              </div>
            );
          }}
        >

          <XAxis
            tickFormat={(d) => lowercaseAmPm(formatDateTooltip(d, { interval, start, end, dataAvailableFrom }))}
          />
          <YAxis showGridLines tickFormat={(val) => formatValue(val)} />
          {showRevenueBars && (
            <Bars
              series={revenueBarSeries}
              seriesStyles={[
                {
                  id: "revenueBar",
                  barFill: "currentColor",
                  barClassName: isKpiMode
                    ? "text-[#A855F7]/25"
                    : "text-[#10B981]/25",
                },
              ]}
              radius={2}
            />
          )}
          <Areas
            showLatestValueCircle={false}
            seriesStyles={series.map(({ id }) => ({ id, areaFill: "currentColor", areaOpacity: 0.12, lineStroke: "currentColor" }))}
          />
        </TimeSeriesChart>
      )}

      <SocialActivityModal />
    </div>
  );
}
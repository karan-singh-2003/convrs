
// "use client";

// import { formatDateTooltip } from "./format-date-tooltip";
// import { AnalyticsResponseOptions } from "@/lib/analytics/types";
// import { editQueryString } from "@/lib/analytics/utils";
// import useWorkspace from "@/lib/swr/use-workspace";
// import { Areas, TimeSeriesChart, XAxis, YAxis } from "@repo/ui";
// import { fetcher, formatCurrency, nFormatter } from "@repo/utils";
// import { subDays } from "date-fns";
// import { Fragment, useContext, useMemo } from "react";
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
//     }>;
//   }>(
//     !demo &&
//     `${baseApiPath}?${editQueryString(queryString, {
//       groupBy: "timeseries",
//       event: resource,
//     })}`,
//     fetcher
//   );

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
//   ];

//   const activeSeries = series.find(({ id }) => id === resource);

//   const tooltipLabel =
//     resource === "clicks" ? "Visitors"
//       : resource === "revenue" ? (kpiType === "goal" ? (kpiLabel ?? "Goal") : "Revenue")
//         : resource === "conversion_rate" ? "Conversion"
//           : resource === "bounce_rate" ? "Bounce Rate"
//             : "Avg. Session";

//   const formatValue = (val: number) => {
//     if (resource === "revenue") {
//       return kpiType === "goal" ? nFormatter(val) : formatCurrency(val, currency);
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
//         <div className="w-full h-[464px] bg-neutral-50 space-y-2" />
//       ) : !hasChartData ? (
//         <p className="text-sm font-default text-neutral-500">No analytics data yet.</p>
//       ) : (
//         <TimeSeriesChart
//           key={queryString + resource}
//           data={safeChartData}
//           series={series}
//           defaultTooltipIndex={demo ? DEMO_DATA.length - 2 : undefined}
//           tooltipClassName="p-0 px-6"
//           tooltipContent={(d) => (
//             <div className="w-[170px] py-3 space-y-2">
//               <p className="md:text-[13px] pb-1 border-b border-neutral-200 text-[12px] font-alexandria font-normal text-neutral-500">
//                 {lowercaseAmPm(
//                   formatDateTooltip(d.date, { interval: demo ? "day" : interval, start, end, dataAvailableFrom })
//                 )}
//               </p>
//               <div className="text-sm pt-1">
//                 <Fragment key={resource}>
//                   <div className="flex items-center justify-between gap-2">
//                     <p className="font-alexandria font-normal text-sm md:text-[16px] text-neutral-500">
//                       {tooltipLabel}
//                     </p>
//                     <h1 className="font-alexandria text-sm md:text-[16px] font-medium text-neutral-500">
//                       {formatValue(activeSeries?.valueAccessor(d) ?? 0)}
//                     </h1>
//                   </div>
//                 </Fragment>
//               </div>
//             </div>
//           )}
//         >
//           <Areas
//             showLatestValueCircle={false}
//             seriesStyles={series.map(({ id }) => ({ id, areaFill: "transparent", lineStroke: "currentColor" }))}
//           />
//           <XAxis
//             tickFormat={(d) => lowercaseAmPm(formatDateTooltip(d, { interval, start, end, dataAvailableFrom }))}
//           />
//           <YAxis showGridLines tickFormat={(val) => formatValue(val)} />
//         </TimeSeriesChart>
//       )}
//     </div>
//   );
// }


// version 2
// "use client";

// import { formatDateTooltip } from "./format-date-tooltip";
// import { AnalyticsResponseOptions } from "@/lib/analytics/types";
// import { editQueryString } from "@/lib/analytics/utils";
// import useWorkspace from "@/lib/swr/use-workspace";
// import { Areas, TimeSeriesChart, XAxis, YAxis } from "@repo/ui";
// import { fetcher, formatCurrency, nFormatter } from "@repo/utils";
// import { subDays } from "date-fns";
// import { Fragment, useContext, useMemo } from "react";
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
//   console.log("response", response)
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
//         <div className="w-full h-[464px] bg-neutral-50 space-y-2" />
//       ) : !hasChartData ? (
//         <p className="text-sm font-default text-neutral-500">No analytics data yet.</p>
//       ) : (
//         <TimeSeriesChart
//           key={queryString + resource}
//           data={safeChartData}
//           series={series}
//           defaultTooltipIndex={demo ? DEMO_DATA.length - 2 : undefined}
//           tooltipClassName="p-0 px-6"
//           tooltipContent={(d) => {
//             const netRevenue = (d.values.new_revenue ?? 0) - (d.values.refund_amount ?? 0);
//             return (
//               // for visitors and revenue
//               <div className="w-[220px] font-alexandria py-3 px-1 space-y-2">
//                 <p className="pb-1 border-b font-alexandria border-neutral-200 text-[12px] text-neutral-500 font-medium">
//                   {lowercaseAmPm(formatDateTooltip(d.date, { interval, start, end, dataAvailableFrom }))}
//                 </p>

//                 {/* not for revenue tab only visitors  */}
//                 <div className="space-y-1 pb-2 border-b border-neutral-200">
//                   <div className="flex justify-between text-sm">
//                     <span className="font-medium text-neutral-500">Visitors</span>
//                     <span className="font-medium text-neutral-500">{nFormatter((d.values.new_visitors ?? 0) + (d.values.returning_visitors ?? 0))}</span>
//                   </div>
//                   <p className="text-xs text-neutral-500">
//                     {nFormatter(d.values.new_visitors ?? 0)} New and {nFormatter(d.values.returning_visitors ?? 0)} returning
//                   </p>
//                 </div>

//                 <div className="space-y-1 pb-2 border-b border-neutral-200">
//                   <div className="flex justify-between text-sm">
//                     <span className="font-medium text-neutral-500">Revenue</span>
//                     <span className="font-medium text-neutral-500">{formatCurrency(netRevenue, currency)}</span>
//                   </div>
//                   <p className="text-xs text-neutral-500">
//                     {formatCurrency(d.values.new_revenue ?? 0, currency)} New and {formatCurrency(d.values.refund_amount ?? 0, currency)} refunds
//                   </p>
//                 </div>

//                 <div className="flex justify-between text-sm">
//                   <span className="font-medium text-neutral-500">Revenue/visitor</span>
//                   <span className="font-medium text-neutral-500">{formatCurrency(d.values.revenue_per_visitor ?? 0, currency)}</span>
//                 </div>
//                 <div className="flex justify-between text-sm">
//                   <span className="font-medium text-neutral-500">Conversion rate</span>
//                   <span className="font-medium text-neutral-500">{nFormatter(d.values.conversion_rate ?? 0)}%</span>
//                 </div>
//               </div>
//               // for bouncerate avgsessionduration conversion revenue/visitor
//               // <div className="w-[170px] py-3 space-y-2">
//               //   <p className="md:text-[13px] pb-1 border-b border-neutral-200 text-[12px] font-alexandria font-normal text-neutral-500">
//               //     {lowercaseAmPm(
//               //       formatDateTooltip(d.date, { interval: demo ? "day" : interval, start, end, dataAvailableFrom })
//               //     )}
//               //   </p>
//               //   <div className="text-sm pt-1">
//               //     <Fragment key={resource}>
//               //       <div className="flex items-center justify-between gap-2">
//               //         <p className="font-alexandria font-normal text-sm md:text-[16px] text-neutral-500">
//               //           {tooltipLabel}
//               //         </p>
//               //         <h1 className="font-alexandria text-sm md:text-[16px] font-medium text-neutral-500">
//               //           {formatValue(activeSeries?.valueAccessor(d) ?? 0)}
//               //         </h1>
//               //       </div>
//               //     </Fragment>
//               //   </div>
//               // </div>
//             );
//           }}
//         >
//           <Areas
//             showLatestValueCircle={false}
//             seriesStyles={series.map(({ id }) => ({ id, areaFill: "transparent", lineStroke: "currentColor" }))}
//           />
//           <XAxis
//             tickFormat={(d) => lowercaseAmPm(formatDateTooltip(d, { interval, start, end, dataAvailableFrom }))}
//           />
//           <YAxis showGridLines tickFormat={(val) => formatValue(val)} />
//         </TimeSeriesChart>
//       )}
//     </div>
//   );
// }


// version 3
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

// type ChartSeries = {
//   id: string;
//   valueAccessor: (d: any) => number;
//   colorClassName: string;
// };

// type ChartConfig = {
//   series: ChartSeries[];
//   yFormat: (val: number) => string;
// };

// function buildChartConfigs(currency: string): Record<string, ChartConfig> {
//   return {
//     clicks: {
//       series: [
//         {
//           id: "new_visitors",
//           valueAccessor: (d) => d.values.new_visitors ?? 0,
//           colorClassName: "text-[#3B82F6]", // Blue
//         },
//         {
//           id: "returning_visitors",
//           valueAccessor: (d) => d.values.returning_visitors ?? 0,
//           colorClassName: "text-[#93C5FD]", // Light blue
//         },
//       ],
//       yFormat: (val) => nFormatter(val),
//     },
//     revenue: {
//       series: [
//         {
//           id: "new_revenue",
//           valueAccessor: (d) => d.values.new_revenue ?? 0,
//           colorClassName: "text-[#10B981]", // Emerald
//         },
//         {
//           id: "refund_amount",
//           valueAccessor: (d) => -(d.values.refund_amount ?? 0),
//           colorClassName: "text-[#F87171]", // Red
//         },
//       ],
//       yFormat: (val) => formatCurrency(val, currency),
//     },
//     conversion_rate: {
//       series: [
//         {
//           id: "conversion_rate",
//           valueAccessor: (d) => d.values.conversion_rate ?? 0,
//           colorClassName: "text-[#A855F7]", // Purple
//         },
//       ],
//       yFormat: (val) => `${nFormatter(val)}%`,
//     },
//     bounce_rate: {
//       series: [
//         {
//           id: "bounce_rate",
//           valueAccessor: (d) => d.values.bounce_rate ?? 0,
//           colorClassName: "text-[#EF4444]", // Red
//         },
//       ],
//       yFormat: (val) => `${nFormatter(val)}%`,
//     },
//     avg_session_duration: {
//       series: [
//         {
//           id: "avg_session_duration",
//           valueAccessor: (d) => d.values.avg_session_duration ?? 0,
//           colorClassName: "text-[#F59E0B]", // Amber
//         },
//       ],
//       yFormat: (val) => formatDuration(val),
//     },
//     revenue_per_visitor: {
//       series: [
//         {
//           id: "revenue_per_visitor",
//           valueAccessor: (d) => d.values.revenue_per_visitor ?? 0,
//           colorClassName: "text-[#14B8A6]", // Teal
//         },
//       ],
//       yFormat: (val) => formatCurrency(val, currency),
//     },
//   };
// }

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

//   const chartConfigs = useMemo(() => buildChartConfigs(currency), [currency]);
//   const activeConfig = chartConfigs[resource] ?? chartConfigs.clicks;

//   // used only for the "simple" tooltip branch (bounce_rate, avg_session_duration, revenue_per_visitor)
//   const singleValueAccessor = activeConfig.series[0]?.valueAccessor;

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
//         <div className="w-full h-[464px] bg-neutral-50 space-y-2" />
//       ) : !hasChartData ? (
//         <p className="text-sm font-default text-neutral-500">No analytics data yet.</p>
//       ) : (
//         <TimeSeriesChart
//           key={queryString + resource}
//           data={safeChartData}
//           series={activeConfig.series}
//           defaultTooltipIndex={demo ? DEMO_DATA.length - 2 : undefined}
//           tooltipClassName="p-0 px-6"
//           tooltipContent={(d) => {
//             const dateLabel = lowercaseAmPm(
//               formatDateTooltip(d.date, { interval, start, end, dataAvailableFrom })
//             );

//             // --- CLICKS: fully detailed (visitors + conversion) ---
//             if (resource === "clicks") {
//               return (
//                 <div className="w-[220px] font-alexandria py-3 px-1 space-y-2">
//                   <p className="pb-1 border-b font-alexandria border-neutral-200 text-[12px] text-neutral-500 font-medium">
//                     {dateLabel}
//                   </p>
//                   <div className="space-y-1 pb-2 border-b border-neutral-200">
//                     <div className="flex justify-between text-sm">
//                       <span className="font-medium text-neutral-500">Visitors</span>
//                       <span className="font-medium text-neutral-500">
//                         {nFormatter((d.values.new_visitors ?? 0) + (d.values.returning_visitors ?? 0))}
//                       </span>
//                     </div>
//                     <p className="text-xs text-neutral-500">
//                       {nFormatter(d.values.new_visitors ?? 0)} New and {nFormatter(d.values.returning_visitors ?? 0)} returning
//                     </p>
//                   </div>
//                   <div className="flex justify-between text-sm">
//                     <span className="font-medium text-neutral-500">Conversion rate</span>
//                     <span className="font-medium text-neutral-500">{nFormatter(d.values.conversion_rate ?? 0)}%</span>
//                   </div>
//                 </div>
//               );
//             }

//             // --- REVENUE: partial detail (revenue breakdown + per-visitor) ---
//             if (resource === "revenue") {
//               const netRevenue = (d.values.new_revenue ?? 0) - (d.values.refund_amount ?? 0);
//               return (
//                 <div className="w-[220px] font-alexandria py-3 px-1 space-y-2">
//                   <p className="pb-1 border-b font-alexandria border-neutral-200 text-[12px] text-neutral-500 font-medium">
//                     {dateLabel}
//                   </p>
//                   <div className="space-y-1 pb-2 border-b border-neutral-200">
//                     <div className="flex justify-between text-sm">
//                       <span className="font-medium text-neutral-500">
//                         {kpiType === "goal" ? (kpiLabel ?? "Goal") : "Revenue"}
//                       </span>
//                       <span className="font-medium text-neutral-500">{formatCurrency(netRevenue, currency)}</span>
//                     </div>
//                     {kpiType !== "goal" && (
//                       <p className="text-xs text-neutral-500">
//                         {formatCurrency(d.values.new_revenue ?? 0, currency)} New and {formatCurrency(d.values.refund_amount ?? 0, currency)} refunds
//                       </p>
//                     )}
//                   </div>
//                   <div className="flex justify-between text-sm">
//                     <span className="font-medium text-neutral-500">Revenue/visitor</span>
//                     <span className="font-medium text-neutral-500">{formatCurrency(d.values.revenue_per_visitor ?? 0, currency)}</span>
//                   </div>
//                 </div>
//               );
//             }

//             // --- everything else: simple single-value tooltip ---
//             return (
//               <div className="w-[170px] py-3 space-y-2">
//                 <p className="md:text-[13px] pb-1 border-b border-neutral-200 text-[12px] font-alexandria font-normal text-neutral-500">
//                   {dateLabel}
//                 </p>
//                 <div className="text-sm pt-1">
//                   <div className="flex items-center justify-between gap-2">
//                     <p className="font-alexandria font-normal text-sm md:text-[16px] text-neutral-500">
//                       {tooltipLabel}
//                     </p>
//                     <h1 className="font-alexandria text-sm md:text-[16px] font-medium text-neutral-500">
//                       {formatValue(singleValueAccessor?.(d) ?? 0)}
//                     </h1>
//                   </div>
//                 </div>
//               </div>
//             );
//           }}
//         >
//           <Areas
//             showLatestValueCircle={false}
//             seriesStyles={activeConfig.series.map(({ id }) => ({
//               id,
//               areaFill: "currentColor",
//               areaOpacity: 0.15,
//               lineStroke: "currentColor",
//             }))}
//           />
//           <XAxis
//             tickFormat={(d) => lowercaseAmPm(formatDateTooltip(d, { interval, start, end, dataAvailableFrom }))}
//           />
//           <YAxis showGridLines tickFormat={(val) => activeConfig.yFormat(val)} />
//         </TimeSeriesChart>
//       )}
//     </div>
//   );
// }


// version 4


"use client";

import { formatDateTooltip } from "./format-date-tooltip";
import { AnalyticsResponseOptions } from "@/lib/analytics/types";
import { editQueryString } from "@/lib/analytics/utils";
import useWorkspace from "@/lib/swr/use-workspace";
import { Areas, TimeSeriesChart, XAxis, YAxis } from "@repo/ui";
import { fetcher, formatCurrency, nFormatter } from "@repo/utils";
import { subDays } from "date-fns";
import { useContext, useMemo } from "react";
import useSWR from "swr";
import { AnalyticsContext } from "./analytics-providers";
import { formatDuration } from "./analytics-tabs";

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

const RATE_METRICS = new Set(["conversion_rate", "bounce_rate"]);
const DURATION_METRICS = new Set(["avg_session_duration"]);

export function AnalyticsAreaChart({
  resource,
  demo,
}: {
  resource: Exclude<AnalyticsResponseOptions, "live_visitors">;
  demo?: boolean;
}) {
  const { createdAt: workspaceCreatedAt, currency = "USD" } = useWorkspace();

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
  console.log("Data", response)
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

  return (
    <div className="flex h-full w-full items-center justify-center">
      {showInitialLoader ? (
        <div className="w-full h-[464px] bg-neutral-50 space-y-2" />
      ) : !hasChartData ? (
        <p className="text-sm font-default text-neutral-500">No analytics data yet.</p>
      ) : (
        <TimeSeriesChart
          key={queryString + resource}
          data={safeChartData}
          series={series}
          defaultTooltipIndex={demo ? DEMO_DATA.length - 2 : undefined}
          tooltipClassName="p-0 px-6"
          tooltipContent={(d) => {
            const dateLabel = lowercaseAmPm(
              formatDateTooltip(d.date, { interval, start, end, dataAvailableFrom })
            );

            // --- CLICKS: fully detailed ---
            if (resource === "clicks") {
              const netRevenue = (d.values.new_revenue ?? 0) - (d.values.refund_amount ?? 0);
              const isGoal = kpiType === "goal";
              return (
                <div className="w-[260px] font-alexandria py-3 px-1 space-y-2">
                  <p className="pb-1 border-b font-alexandria border-neutral-200 text-[12px] text-neutral-500 font-medium">
                    {dateLabel}
                  </p>
                  <div className="space-y-1 pb-2 border-b border-neutral-200">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-neutral-500">Visitors</span>
                      <span className="font-medium text-neutral-500">
                        {nFormatter((d.values.new_visitors ?? 0) + (d.values.returning_visitors ?? 0))}
                      </span>
                    </div>
                    <p className="text-[13px] text-neutral-500">
                      {nFormatter(d.values.new_visitors ?? 0)} New and {nFormatter(d.values.returning_visitors ?? 0)} returning
                    </p>
                  </div>
                  <div className="space-y-1 pb-2 border-b border-neutral-200">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-neutral-500">
                        {isGoal ? (kpiLabel ?? "Goal") : "Revenue"}
                      </span>
                      <span className="font-medium text-neutral-500">
                        {isGoal ? nFormatter(d.values.revenue ?? 0) : formatCurrency(netRevenue, currency)}
                      </span>
                    </div>
                    {!isGoal && (
                      <p className="text-xs text-neutral-500">
                        {formatCurrency(d.values.new_revenue ?? 0, currency)} New and {formatCurrency(d.values.refund_amount ?? 0, currency)} refunds
                      </p>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-neutral-500">Conversion rate</span>
                    <span className="font-medium text-neutral-500">{nFormatter(d.values.conversion_rate ?? 0)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-neutral-500">Revenue/visitor</span>
                    <span className="font-medium text-neutral-500">{formatCurrency(d.values.revenue_per_visitor ?? 0, currency)}</span>
                  </div>
                </div>
              );
            }

            // --- REVENUE: partial detail ---
            if (resource === "revenue") {
              const netRevenue = (d.values.new_revenue ?? 0) - (d.values.refund_amount ?? 0);
              const isGoal = kpiType === "goal";
              return (
                <div className="w-[220px] font-alexandria py-3 px-1 space-y-2">
                  <p className="pb-1 border-b font-alexandria border-neutral-200 text-[12px] text-neutral-500 font-medium">
                    {dateLabel}
                  </p>
                  <div className="space-y-1 pb-2 border-b border-neutral-200">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-neutral-500">
                        {isGoal ? (kpiLabel ?? "Goal") : "Revenue"}
                      </span>
                      <span className="font-medium text-neutral-500">
                        {isGoal ? nFormatter(d.values.revenue ?? 0) : formatCurrency(netRevenue, currency)}
                      </span>
                    </div>
                    {!isGoal && (
                      <p className="text-xs text-neutral-500">
                        {formatCurrency(d.values.new_revenue ?? 0, currency)} New and {formatCurrency(d.values.refund_amount ?? 0, currency)} refunds
                      </p>
                    )}
                  </div>
                  {!isGoal && (
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-neutral-500">Revenue/visitor</span>
                      <span className="font-medium text-neutral-500">{formatCurrency(d.values.revenue_per_visitor ?? 0, currency)}</span>
                    </div>
                  )}
                </div>
              );
            }

            // --- everything else: simple, with clicks as context ---
            return (
              <div className="w-[190px] py-3 space-y-2">
                <p className="md:text-[13px] pb-1 border-b border-neutral-200 text-[12px] font-alexandria font-normal text-neutral-500">
                  {dateLabel}
                </p>
                <div className="text-sm pt-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-alexandria font-normal text-sm md:text-[16px] text-neutral-500">
                      {tooltipLabel}
                    </p>
                    <h1 className="font-alexandria text-sm md:text-[16px] font-medium text-neutral-500">
                      {formatValue(activeSeries?.valueAccessor(d) ?? 0)}
                    </h1>
                  </div>
                  <p className="text-[13px] font-alexandria text-neutral-500">
                    {nFormatter(d.values.clicks ?? 0)} visitors this period
                  </p>
                </div>
              </div>
            );
          }}
        >
          <Areas
            showLatestValueCircle={false}
            seriesStyles={series.map(({ id }) => ({ id, areaFill: "transparent", lineStroke: "currentColor" }))}
          />
          <XAxis
            tickFormat={(d) => lowercaseAmPm(formatDateTooltip(d, { interval, start, end, dataAvailableFrom }))}
          />
          <YAxis showGridLines tickFormat={(val) => formatValue(val)} />
        </TimeSeriesChart>
      )}
    </div>
  );
}
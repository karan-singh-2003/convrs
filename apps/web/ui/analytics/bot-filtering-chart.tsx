// "use client";

// import { useContext, useMemo } from "react";
// import { subDays } from "date-fns";
// import useSWR from "swr";
// import { Areas, TimeSeriesChart, XAxis, YAxis } from "@repo/ui";
// import { fetcher, nFormatter } from "@repo/utils";
// import { formatDateTooltip } from "./format-date-tooltip";
// import { AnalyticsContext } from "./analytics-providers";
// import { editQueryString } from "@/lib/analytics/utils";
// import { ChatGptIcon, GeminiIcon, ClaudeIcon, DuckDuckGoIcon } from "@/ui/icons/ai";

// type BotKey = "chatgpt" | "gemini" | "claude" | "duckduckgo";

// const BOT_CONFIG: Record<
//   BotKey,
//   { label: string; colorClassName: string; icon: React.ComponentType<{ className?: string }> }
// > = {
//   chatgpt: { label: "ChatGPT", colorClassName: "text-[#10A37F]", icon: ChatGptIcon },
//   gemini: { label: "Gemini", colorClassName: "text-[#3186FF]", icon: GeminiIcon },
//   claude: { label: "Claude", colorClassName: "text-[#D97757]", icon: ClaudeIcon },
//   duckduckgo: { label: "DuckDuckGo", colorClassName: "text-[#DE5833]", icon: DuckDuckGoIcon },
// };

// const BOT_KEYS = Object.keys(BOT_CONFIG) as BotKey[];

// function lowercaseAmPm(value: string) {
//   return value.replace(/\bAM\b/g, "am").replace(/\bPM\b/g, "pm");
// }

// // rough demo shape: each day has a count per bot, weighted so chatgpt dominates
// const DEMO_DATA = [
//   180, 230, 320, 305, 330, 290, 340, 310, 380, 360, 270, 360, 280, 270, 350,
//   370, 350, 340, 300,
// ]
//   .reverse()
//   .map((value, index) => ({
//     date: subDays(new Date(), index),
//     values: {
//       chatgpt: Math.round(value * 0.87),
//       gemini: Math.round(value * 0.11),
//       claude: Math.round(value * 0.02),
//       duckduckgo: Math.round(value * 0.01),
//     },
//   }))
//   .reverse();

// type BotChartDatum = {
//   date: Date;
//   values: Record<BotKey, number>;
// };

// export function BotFilteringAreaChart({ demo }: { demo?: boolean }) {
//   const { baseApiPath, queryString, start, end, interval } =
//     useContext(AnalyticsContext);

//   // if `demo` is explicitly forced by the parent, never hit the network at all
//   const { data: response, isLoading } = useSWR<{
//     data: Array<{
//       start: string;
//       chatgpt: number;
//       gemini: number;
//       claude: number;
//       duckduckgo: number;
//     }>;
//   }>(
//     !demo &&
//       `${baseApiPath}?${editQueryString(queryString, {
//         groupBy: "timeseries",
//         event: "bot_filtering",
//       })}`,
//     fetcher
//   );

//   const realData: BotChartDatum[] | null = useMemo(() => {
//     if (!response?.data || !Array.isArray(response.data)) return null;
//     return response.data.map(({ start, chatgpt, gemini, claude, duckduckgo }) => ({
//       date: new Date(start),
//       values: { chatgpt, gemini, claude, duckduckgo },
//     }));
//   }, [response]);

//   // Priority: forced demo prop > real data once it arrives > demo data as placeholder while loading/empty
//   const chartData: BotChartDatum[] = demo
//     ? DEMO_DATA
//     : realData && realData.length > 0
//       ? realData
//       : DEMO_DATA;

//   // true only when we're actually showing placeholder demo numbers instead of real ones
//   const isShowingDemoPlaceholder = !demo && (isLoading || !realData || realData.length === 0);

//   const safeChartData = useMemo(
//     () =>
//       chartData.filter(
//         (item) => item.date instanceof Date && !Number.isNaN(item.date.getTime())
//       ),
//     [chartData]
//   );

//   const series = BOT_KEYS.map((key) => ({
//     id: key,
//     valueAccessor: (d: BotChartDatum) => d.values[key],
//     isActive: true,
//     colorClassName: BOT_CONFIG[key].colorClassName,
//   }));

//   return (
//     <div className="relative flex h-full w-full items-center justify-center">
//       {isShowingDemoPlaceholder && (
//         <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-2">
//           <span className="rounded-full bg-bg-subtle px-2.5 py-1 text-[11px] font-alexandria text-content-subtle">
//             Sample data
//           </span>
//         </div>
//       )}

//       <TimeSeriesChart
//         key={queryString}
//         data={safeChartData}
//         series={series}
//         tooltipClassName="p-0 px-6 bg-bg-default"
//         tooltipContent={(d) => {
//           const dateLabel = lowercaseAmPm(
//             formatDateTooltip(d.date, { interval, start, end })
//           );
//           const total = BOT_KEYS.reduce((sum, key) => sum + (d.values[key] ?? 0), 0);

//           return (
//             <div className="w-[220px] font-alexandria py-3 px-1 space-y-2">
//               <p className="pb-1 border-b font-alexandria border-border-subtle text-[12px] text-content-subtle font-medium">
//                 {dateLabel}
//               </p>
//               <div className="space-y-1.5">
//                 {BOT_KEYS.map((key) => {
//                   const Icon = BOT_CONFIG[key].icon;
//                   const value = d.values[key] ?? 0;
//                   const pct = total > 0 ? Math.round((value / total) * 100) : 0;

//                   return (
//                     <div key={key} className="flex items-center justify-between text-sm">
//                       <span className="flex items-center gap-1.5 text-content-subtle">
//                         <Icon className="size-3.5 shrink-0" />
//                         {BOT_CONFIG[key].label}
//                       </span>
//                       <span className="flex items-center gap-1 font-medium text-content-default">
//                         {nFormatter(value)}
//                         <span className="text-[11px] text-content-subtle font-normal">
//                           ({pct}%)
//                         </span>
//                       </span>
//                     </div>
//                   );
//                 })}
//               </div>
//               <div className="flex justify-between text-sm pt-1 border-t border-border-subtle">
//                 <span className="font-medium text-content-subtle">Total</span>
//                 <span className="font-medium text-content-default">{nFormatter(total)}</span>
//               </div>
//             </div>
//           );
//         }}
//       >
//         <XAxis
//           tickFormat={(d) => lowercaseAmPm(formatDateTooltip(d, { interval, start, end }))}
//         />
//         <YAxis showGridLines tickFormat={(val) => nFormatter(val)} />
//         <Areas
//           showLatestValueCircle={false}
//           seriesStyles={series.map(({ id }) => ({
//             id,
//             areaFill: "currentColor",
//             areaOpacity: 0.12,
//             lineStroke: "currentColor",
//           }))}
//         />
//       </TimeSeriesChart>
//     </div>
//   );
// }


// "use client";

// import { useContext, useMemo } from "react";
// import useSWR from "swr";
// import { Areas, TimeSeriesChart, XAxis, YAxis } from "@repo/ui";
// import { fetcher, nFormatter } from "@repo/utils";
// import { formatDateTooltip } from "./format-date-tooltip";
// import { AnalyticsContext } from "./analytics-providers";
// import { editQueryString } from "@/lib/analytics/utils";
// import { getVendorIcon, getVendorLabel, normalizeVendorKey } from "@/lib/bot/bot-vendor-icons"

// // Stable palette cycled across however many vendors actually show up in the data.
// const VENDOR_COLORS = [
//   "text-[#10A37F]", // openai green
//   "text-[#3186FF]", // google blue
//   "text-[#D97757]", // anthropic orange
//   "text-[#DE5833]", // duckduckgo red
//   "text-[#8B5CF6]", // purple
//   "text-[#F59E0B]", // amber
//   "text-[#EC4899]", // pink
//   "text-[#14B8A6]", // teal
// ];

// function lowercaseAmPm(value: string) {
//   return value.replace(/\bAM\b/g, "am").replace(/\bPM\b/g, "pm");
// }

// type BotTimeseriesRow = {
//   start: string;
//   [vendorKey: string]: string | number;
// };

// export function BotFilteringAreaChart({ category }: { category?: string }) {
//   const { baseApiPath, queryString, start, end, interval } = useContext(AnalyticsContext);

//   const { data: response, isLoading } = useSWR<{ data: BotTimeseriesRow[] }>(
//     baseApiPath &&
//       `${baseApiPath}?${editQueryString(queryString, {
//         groupBy: "timeseries",
//         event: "bot_filtering",
//         ...(category && { category }),
//       })}`,
//     fetcher
//   );

//   const chartData = useMemo(() => {
//     if (!response?.data) return [];
//     return response.data
//       .map((row) => {
//         const { start: startStr, ...vendorValues } = row;
//         const date = new Date(startStr);
//         if (Number.isNaN(date.getTime())) return null;
//         return { date, values: vendorValues as Record<string, number> };
//       })
//       .filter((row): row is { date: Date; values: Record<string, number> } => row !== null);
//   }, [response]);

//   // Vendor keys are discovered from the actual response, so new bots that
//   // show up in the SDK's registry appear automatically with no code change.
//   const vendorKeys = useMemo(() => {
//     const keys = new Set<string>();
//     for (const row of chartData) {
//       for (const key of Object.keys(row.values)) keys.add(key);
//     }
//     return Array.from(keys).sort(
//       (a, b) =>
//         chartData.reduce((sum, r) => sum + (r.values[b] ?? 0), 0) -
//         chartData.reduce((sum, r) => sum + (r.values[a] ?? 0), 0)
//     );
//   }, [chartData]);

//   const series = vendorKeys.map((key, index) => ({
//     id: key,
//     valueAccessor: (d: { values: Record<string, number> }) => d.values[key] ?? 0,
//     isActive: true,
//     colorClassName: VENDOR_COLORS[index % VENDOR_COLORS.length],
//   }));

//   const isEmpty = !isLoading && chartData.length === 0;

//   return (
//     <div className="relative flex h-full w-full items-center justify-center">
//       {isLoading && (
//         <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-2">
//           <span className="rounded-full bg-bg-subtle px-2.5 py-1 text-[11px] font-alexandria text-content-subtle">
//             Loading…
//           </span>
//         </div>
//       )}

//       {isEmpty ? (
//         <p className="text-xs font-alexandria text-content-subtle">
//           No bot traffic recorded yet.
//         </p>
//       ) : (
//         <TimeSeriesChart
//           key={queryString}
//           data={chartData}
//           series={series}
//           tooltipClassName="p-0 px-6 bg-bg-default"
//           tooltipContent={(d) => {
//             const dateLabel = lowercaseAmPm(
//               formatDateTooltip(d.date, { interval, start, end })
//             );
//             const total = vendorKeys.reduce((sum, key) => sum + (d.values[key] ?? 0), 0);

//             return (
//               <div className="w-[220px] font-alexandria py-3 px-1 space-y-2">
//                 <p className="pb-1 border-b font-alexandria border-border-subtle text-[12px] text-content-subtle font-medium">
//                   {dateLabel}
//                 </p>
//                 <div className="space-y-1.5">
//                   {vendorKeys.map((key) => {
//                     const Icon = getVendorIcon(key);
//                     const value = d.values[key] ?? 0;
//                     const pct = total > 0 ? Math.round((value / total) * 100) : 0;

//                     return (
//                       <div key={key} className="flex items-center justify-between text-sm">
//                         <span className="flex items-center gap-1.5 text-content-subtle">
//                           <Icon className="size-3.5 shrink-0" />
//                           {getVendorLabel(key)}
//                         </span>
//                         <span className="flex items-center gap-1 font-medium text-content-default">
//                           {nFormatter(value)}
//                           <span className="text-[11px] text-content-subtle font-normal">
//                             ({pct}%)
//                           </span>
//                         </span>
//                       </div>
//                     );
//                   })}
//                 </div>
//                 <div className="flex justify-between text-sm pt-1 border-t border-border-subtle">
//                   <span className="font-medium text-content-subtle">Total</span>
//                   <span className="font-medium text-content-default">{nFormatter(total)}</span>
//                 </div>
//               </div>
//             );
//           }}
//         >
//           <XAxis
//             tickFormat={(d) => lowercaseAmPm(formatDateTooltip(d, { interval, start, end }))}
//           />
//           <YAxis showGridLines tickFormat={(val) => nFormatter(val)} />
//           <Areas
//             showLatestValueCircle={false}
//             seriesStyles={series.map(({ id }) => ({
//               id,
//               areaFill: "currentColor",
//               areaOpacity: 0.12,
//               lineStroke: "currentColor",
//             }))}
//           />
//         </TimeSeriesChart>
//       )}
//     </div>
//   );
// }

// export { normalizeVendorKey };



  "use client";

  import { useContext, useMemo } from "react";
  import useSWR from "swr";
  import { Areas, TimeSeriesChart, XAxis, YAxis } from "@repo/ui";
  import { fetcher, nFormatter } from "@repo/utils";
  import { formatDateTooltip } from "./format-date-tooltip";
  import { AnalyticsContext } from "./analytics-providers";
  import { editQueryString, toBotFilteringApiPath } from "@/lib/analytics/utils";
  import { getVendorColor, getVendorIcon, getVendorLabel, normalizeVendorKey } from "@/lib/bot/bot-vendor-icons";

  const VENDOR_COLORS = [
    "text-[#10A37F]",
    "text-[#3186FF]",
    "text-[#D97757]",
    "text-[#DE5833]",
    "text-[#8B5CF6]",
    "text-[#F59E0B]",
    "text-[#EC4899]",
    "text-[#14B8A6]",
  ];

  function lowercaseAmPm(value: string) {
    return value.replace(/\bAM\b/g, "am").replace(/\bPM\b/g, "pm");
  }

  type BotTimeseriesRow = {
    start: string;
    [vendorKey: string]: string | number;
  };

  export function BotFilteringAreaChart({ category }: { category?: string }) {
    const { baseApiPath, queryString, start, end, interval } = useContext(AnalyticsContext);

    const botApiPath = useMemo(() => toBotFilteringApiPath(baseApiPath), [baseApiPath]);

    const { data: response, isLoading } = useSWR<{ data: BotTimeseriesRow[] }>(
      botApiPath &&
      `${botApiPath}?${editQueryString(queryString, {
        groupBy: "timeseries",
        ...(category && { category }),
      })}`,
      fetcher
    );

    console.log("response fo category",category,response)

    const chartData = useMemo(() => {
      if (!response?.data) return [];
      return response.data
        .map((row) => {
          const { start: startStr, ...vendorValues } = row;
          const date = new Date(startStr);
          if (Number.isNaN(date.getTime())) return null;
          return { date, values: vendorValues as Record<string, number> };
        })
        .filter((row): row is { date: Date; values: Record<string, number> } => row !== null);
    }, [response]);
  console.log("char data ",chartData)
    const vendorKeys = useMemo(() => {
      const keys = new Set<string>();
      for (const row of chartData) {
        for (const key of Object.keys(row.values)) keys.add(key);
      }
      return Array.from(keys).sort(
        (a, b) =>
          chartData.reduce((sum, r) => sum + (r.values[b] ?? 0), 0) -
          chartData.reduce((sum, r) => sum + (r.values[a] ?? 0), 0)
      );
    }, [chartData]);

    const series = vendorKeys.map((key, index) => ({
      id: key,
      valueAccessor: (d: { values: Record<string, number> }) => d.values[key] ?? 0,
      isActive: true,
      // colorClassName: VENDOR_COLORS[index % VENDOR_COLORS.length],
      colorClassName: getVendorColor(key),
    }));
  console.log("series",series)
    // Loading skeleton: show whenever we don't yet have series to render,
    // regardless of whether SWR's isLoading flag has flipped false yet.
    if (series.length === 0) {
      return (
        <div className="flex h-full items-center justify-center">
          {isLoading ? (
            <span className="rounded-full bg-bg-subtle px-2.5 py-1 text-[11px] font-alexandria text-content-subtle">
              Loading…
            </span>
          ) : (
            <p className="text-sm font-default text-content-subtle">
              No bot traffic recorded yet.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <TimeSeriesChart
          key={queryString}
          data={chartData}
          series={series}
          tooltipClassName="p-0 px-6 bg-bg-default"
          tooltipContent={(d) => {
            const dateLabel = lowercaseAmPm(
              formatDateTooltip(d.date, { interval, start, end })
            );
            const total = vendorKeys.reduce((sum, key) => sum + (d.values[key] ?? 0), 0);

            return (
              <div className="w-[220px] font-alexandria py-3 px-1 space-y-2">
                <p className="pb-1 border-b font-alexandria border-border-subtle text-[12px] text-content-subtle font-medium">
                  {dateLabel}
                </p>
                <div className="space-y-1.5">
                  {vendorKeys.map((key) => {
                    const Icon = getVendorIcon(key);
                    const value = d.values[key] ?? 0;
                    const pct = total > 0 ? Math.round((value / total) * 100) : 0;

                    return (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-content-subtle">
                          <Icon className="size-3.5 shrink-0" />
                          {getVendorLabel(key)}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-content-default">
                          {nFormatter(value)}
                          <span className="text-[11px] text-content-subtle font-normal">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-border-subtle">
                  <span className="font-medium text-content-subtle">Total</span>
                  <span className="font-medium text-content-default">{nFormatter(total)}</span>
                </div>
              </div>
            );
          }}
        >
          <XAxis tickFormat={(d) => lowercaseAmPm(formatDateTooltip(d, { interval, start, end }))} />
          <YAxis showGridLines tickFormat={(val) => nFormatter(val)} />
          <Areas
            showLatestValueCircle={true}
            seriesStyles={series.map(({ id }) => ({
              id,
              areaFill: "currentColor",
              areaOpacity: 0.12,
              lineStroke: "currentColor",
            }))}
          />
        </TimeSeriesChart>
      </div>
    );
  }

  export { normalizeVendorKey };
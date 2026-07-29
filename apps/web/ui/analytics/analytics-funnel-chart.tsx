// "use client";

// import { FunnelProps } from "@/lib/types";
// import { FunnelChart } from "@repo/ui";
// import { useContext, useMemo } from "react";
// import { AnalyticsContext } from "./analytics-providers";
// import { editQueryString } from "@/lib/analytics/utils";
// import useSWR from "swr";
// import { fetcher } from "@repo/utils";

// export type FunnelData = {
//   step: string;
//   users: number;
// };

// export function AnalyticsFunnelChart({
//   demo ,
//   selectedFunnel,
// }: {
//   demo?: boolean;
//   selectedFunnel?: FunnelProps | null;
// }) {
//   const { baseApiPath, queryString } = useContext(AnalyticsContext);

//   const rawSteps = useMemo(() => {
//     if (selectedFunnel?.steps?.length) {
//       return selectedFunnel.steps
//         .slice()
//         .sort((a, b) => a.order - b.order)
//         .map((step) => ({
//           id: step.id,
//           label: step.name,
//           goal: step.value,
//         }))
//         .slice(0, 8);
//     }

//     return [
//       { id: "clicks", label: "Clicks", goal: "clicks" },
//       { id: "visitors", label: "Visitors", goal: "visitors" },
//       { id: "signups", label: "Signups", goal: "signups" },
//       { id: "activated", label: "Activated", goal: "activated" },
//     ].slice(0, 8);
//   }, [selectedFunnel]);


//   const stepsCsv = useMemo(
//     () => rawSteps.map((step) => step.goal).join(","),
//     [rawSteps]
//   );

//   const currentQueryUrl = useMemo(() => {
//     return `${baseApiPath}?${editQueryString(queryString, {
//       event: "funnel",
//       stepsCsv,
//     })}`;
//   }, [baseApiPath, queryString, stepsCsv]);



//   const { data: funnelApiResponse } = useSWR<{ data: FunnelData[] }>(
//     currentQueryUrl,
//     fetcher,
//   );



//   const usersByStep = useMemo(
//     () =>
//       new Map(
//         (funnelApiResponse?.data ?? []).map(
//           (row) => [row.step, row.users] as const
//         )
//       ),
//     [funnelApiResponse?.data]
//   );

//   const COLORS = [
//     "text-[#9D7CFF]",
//     "text-[#7CAAFF]",
//     "text-[#7CFFE0]",
//     "text-[#7CF6FF]",
//     "text-[#CF7CFF]",
//     "text-[#E0FF7C]",
//     "text-[#FF9A7C]",
//     "text-[#FF7CAC]",
//   ];

//   const steps = useMemo(() => {
//     return rawSteps.map((step, index) => ({
//       id: step.id,
//       label: step.label,
//       goal: step.goal,
//       value: demo
//         ? ([130, 120, 100, 85, 70, 55, 40, 24][index] ?? 0)
//         : (usersByStep.get(step.goal) ?? 0),
//       colorClassName: COLORS[index],
//     }));
//   }, [demo, rawSteps, usersByStep]);

//   return (
//     <div className="h-full w-full">
//       <FunnelChart steps={steps} defaultTooltipStepId="" />
//     </div>
//   );
// }

"use client";

import { FunnelProps } from "@/lib/types";
import { FunnelChart } from "@repo/ui";
import { useContext, useMemo } from "react";
import { AnalyticsContext } from "./analytics-providers";
import { editQueryString } from "@/lib/analytics/utils";
import useSWR from "swr";
import { fetcher, nFormatter, currencyFormatter } from "@repo/utils";

type FunnelStepData = {
  step: string;
  users: number;
  stepValue?: number;
  topSources: { referer: string; visitors: number; pct: number }[];
  topCountries: { country: string; visitors: number; pct: number }[];
};

export function AnalyticsFunnelChart({
  demo,
  selectedFunnel,
}: {
  demo?: boolean;
  selectedFunnel?: FunnelProps | null;
}) {
  const { baseApiPath, queryString, currency } = useContext(AnalyticsContext);

  const rawSteps = useMemo(() => {
    if (selectedFunnel?.steps?.length) {
      return selectedFunnel.steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((step) => ({ id: step.id, label: step.name, goal: step.value }))
        .slice(0, 8);
    }
    return [
      { id: "clicks", label: "Clicks", goal: "clicks" },
      { id: "visitors", label: "Visitors", goal: "visitors" },
      { id: "signups", label: "Signups", goal: "signups" },
      { id: "activated", label: "Activated", goal: "activated" },
    ].slice(0, 8);
  }, [selectedFunnel]);

  const stepsCsv = useMemo(() => rawSteps.map((step) => step.goal).join(","), [rawSteps]);

  const currentQueryUrl = useMemo(
    () => `${baseApiPath}?${editQueryString(queryString, { event: "funnel", stepsCsv })}`,
    [baseApiPath, queryString, stepsCsv]
  );

  const { data: funnelApiResponse } = useSWR<{ data: FunnelStepData[] }>(currentQueryUrl, fetcher);

  const dataByStep = useMemo(
    () => new Map((funnelApiResponse?.data ?? []).map((row) => [row.step, row] as const)),
    [funnelApiResponse?.data]
  );

  const COLORS = [
    "text-[#9D7CFF]", "text-[#7CAAFF]", "text-[#7CFFE0]", "text-[#7CF6FF]",
    "text-[#CF7CFF]", "text-[#E0FF7C]", "text-[#FF9A7C]", "text-[#FF7CAC]",
  ];

  const steps = useMemo(() => {
    return rawSteps.map((step, index) => ({
      id: step.id,
      label: step.label,
      goal: step.goal,
      value: demo
        ? ([130, 120, 100, 85, 70, 55, 40, 24][index] ?? 0)
        : (dataByStep.get(step.goal)?.users ?? 0),
      colorClassName: COLORS[index],
    }));
  }, [demo, rawSteps, dataByStep]);

  const firstStepValue = steps[0]?.value ?? 0;

  return (
    <div className="h-full w-full">
      <FunnelChart
        steps={steps}
        defaultTooltipStepId=""
        renderTooltip={(tooltipStep, index) => {
          const raw = dataByStep.get(tooltipStep.id);
          const prevStep = steps[index - 1];
          const isFirstStep = index === 0;

          const dropoff = !isFirstStep ? (prevStep?.value ?? 0) - tooltipStep.value : undefined;
          const conversionFromPrev =
            !isFirstStep && prevStep?.value ? Math.round((tooltipStep.value / prevStep.value) * 1000) / 10 : undefined;
          const conversionFromStart =
            !isFirstStep && firstStepValue > 0 ? Math.round((tooltipStep.value / firstStepValue) * 1000) / 10 : undefined;

          const stepValueLabel =
            raw?.stepValue !== undefined
              ? `${currencyFormatter(raw.stepValue, { currency })}/visitor`
              : undefined;

          return (
            <div className="rounded-2xl w-72 bg-bg-emphasis text-base border border-border-subtle overflow-hidden">
              {/* Header */}
              <div className="px-3 py-2.5 sm:px-4 sm:py-3 space-y-1">
                <p className="flex items-center gap-1.5 font-default text-sm text-content-default">
                  {/* {!isFirstStep && (
                    <span className="text-content-subtle">↳</span>
                  )} */}
                  <span className="truncate">{tooltipStep.label}</span>
                  <span className="ml-auto font-medium">{nFormatter(tooltipStep.value, { full: true })}</span>
                </p>

                {!isFirstStep && dropoff !== undefined && dropoff > 0 && (
                  <p className="flex items-center justify-between text-xs text-content-subtle">
                    <span className="flex items-center gap-1">
                      <span>↳</span> Dropoff
                    </span>
                    <span className="text-red-500 font-medium">-{nFormatter(dropoff, { full: true })}</span>
                  </p>
                )}
              </div>

              {/* Conversion + step value */}
              <div className="border-t border-border-subtle px-3 py-2.5 sm:px-4 sm:py-3 space-y-1.5 text-sm">
                {!isFirstStep && conversionFromPrev !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-content-subtle">Conversion</span>
                    <span className="text-green-500 font-medium">{conversionFromPrev}%</span>
                  </div>
                )}
                {!isFirstStep && conversionFromStart !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-content-subtle">Conversion from start</span>
                    <span className="font-medium text-content-default">{conversionFromStart}%</span>
                  </div>
                )}
                {stepValueLabel && (
                  <div className="flex items-center justify-between">
                    <span className="text-content-subtle">Step value</span>
                    <span className="font-medium text-content-default">{stepValueLabel}</span>
                  </div>
                )}
              </div>

              {/* Top sources + top countries */}
              {(raw?.topSources?.length || raw?.topCountries?.length) ? (
                <div className="border-t border-border-subtle grid grid-cols-2 gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-xs">
                  {!!raw?.topSources?.length && (
                    <div>
                      <p className="mb-1.5 font-medium text-content-subtle uppercase tracking-wide text-[10px]">Top Sources</p>
                      <div className="space-y-1">
                        {raw.topSources.map((s) => (
                          <div key={s.referer} className="flex items-center justify-between gap-2">
                            <span className="truncate text-content-default">{s.referer || "(direct)"}</span>
                            <span className="text-content-subtle shrink-0">{s.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!!raw?.topCountries?.length && (
                    <div>
                      <p className="mb-1.5 font-medium text-content-subtle uppercase tracking-wide text-[10px]">Top Countries</p>
                      <div className="space-y-1">
                        {raw.topCountries.map((c) => (
                          <div key={c.country} className="flex items-center justify-between gap-2">
                            <span className="truncate text-content-default">{c.country}</span>
                            <span className="text-content-subtle shrink-0">{c.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        }}
      />
    </div>
  );
}
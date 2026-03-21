"use client";

import { cn } from "@repo/utils";
import { ChevronRight, Lock } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { AnalyticsResponse } from "./analytics-providers";

type Tab = {
  id: string;
  label: string;
  colorClassName: string;
  unit?: "currency" | "percentage" | "seconds" | "number";
};

export function AnalyticsTabs({
  tab,
  totalEvents,
  requiresUpgrade,
}: {
  tab: string;
  totalEvents: AnalyticsResponse | null;
  requiresUpgrade: boolean;
}) {
  const tabs: Tab[] = [
    {
      id: "visitors",
      label: "Visitors",
      colorClassName: "text-blue-500/50",
      unit: "number",
    },
    // {
    //   id: "revenue",
    //   label: "Revenue",
    //   colorClassName: "text-violet-500/50",
    //   unit: "currency",
    // },
    {
      id: "online",
      label: "Online",
      colorClassName: "text-teal-500/50",
      unit: "number",
    },
    {
      id: "conversionrate",
      label: "Conversion ",
      colorClassName: "text-orange-500/50",
      unit: "percentage",
    },
    {
      id: "bouncerate",
      label: "Bounce Rate",
      colorClassName: "text-red-500/50",
      unit: "percentage",
    },
    {
      id: "sessions",
      label: "Avg Session ",
      colorClassName: "text-green-500/50",
      unit: "seconds",
    },
  ];

  const formatValue = (value: number, unit?: string) => {
    if (unit === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
    }
    if (unit === "percentage") {
      return `${value.toFixed(1)}%`;
    }
    if (unit === "seconds") {
      const minutes = Math.floor(value / 60);
      const seconds = Math.floor(value % 60);
      return `${minutes}m ${seconds}s`;
    }
    return value.toLocaleString();
  };

  const dataKeyMap: Record<string, string> = {
    visitors: "visitors",
    online: "online",
    conversionrate: "conversionRate",
    bouncerate: "bounceRate",
    sessions: "avgSession",
  };

  return (
    <div className="grid w-full grid-cols-3 sm:grid-cols-5 divide-x  divide-neutral-200">
      {tabs.map(({ id, label, colorClassName, unit }, idx) => {
        const dataKey = dataKeyMap[id] ?? id;

        const current =
          totalEvents?.current?.[dataKey as keyof typeof totalEvents.current] ??
          0;
        const previous =
          totalEvents?.previous?.[
            dataKey as keyof typeof totalEvents.previous
          ] ?? 0;

        const delta =
          current !== 0 && previous !== 0 && previous !== undefined
            ? ((current - previous) / previous) * 100
            : null;

        return (
          <div key={id} className="relative">
            {/* Arrow separator */}
            {idx > 0 && (
              <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full p-1"></div>
            )}

            <div
              className={cn(
                "relative px-4 py-4 space-y-2 sm:px-6 sm:py-5",
                "hover:bg-neutral-50 transition-colors"
              )}
            >
              {/* Label */}
              <div className="flex items-center font-medium font-display gap-2 text-[13.5px] text-neutral-600/90">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full bg-current",
                    colorClassName
                  )}
                />
                {label}
              </div>
              {/* Value */}
              <div className="flex h-fit items-center">
                {current !== undefined && current > 0 ? (
                  <div className="flex flex-col items-start leading-0">
                    <div className="text-[14px] font-display mb-1 text-neutral-600/90 font-semibold sm:text-[20px]">
                      {formatValue(current, unit)}
                    </div>

                    {/* <div
                      className={cn(
                        "text-xs font-default font-medium px-2 py-1 rounded-full",
                        delta !== null &&
                          delta > 0 &&
                          "bg-[#effbf2] text-[#33c758]",
                        delta !== null &&
                          delta < 0 &&
                          "bg-[#fff3f0] text-[#ff2f00]",
                        delta === null && "bg-[#fff8eb] text-[#ffa600]"
                      )}
                    >
                      {delta !== null ? (
                        <>
                          {delta > 0 && "+"}
                          {delta.toFixed(1)}%
                        </>
                      ) : (
                        <span className="font-display font-medium text-sm">
                          0
                        </span>
                      )}
                    </div> */}
                  </div>
                ) : requiresUpgrade ? (
                  <div className="rounded-full bg-neutral-100 p-2">
                    <Lock className="h-4 w-4 text-neutral-500" />
                  </div>
                ) : (
                  <div className="text-base font-display font-medium text-neutral-500">
                    {formatValue(0, unit)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

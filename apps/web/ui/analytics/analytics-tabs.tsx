import {
  AnalyticsResponseOptions,
  AnalyticsSaleUnit,
  EventType,
} from "@/lib/analytics/types";
import { ToggleGroup } from "@repo/ui";
import { cn } from "@repo/utils";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { ArrowDown, ArrowUp, ChevronRight, Lock, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import {
  formatPercentageChange,
  getChangeDirection,
} from "@/lib/analytics/utils/calculate-percentage-change";

type Tab = {
  id: EventType;
  label: string;
  colorClassName: string;
  conversions: boolean;
};

export function AnalyticsTabs({
  showConversions,
  totalEvents,
  percentageChanges,
  tab,
  tabHref,
  saleUnit,
  setSaleUnit,
  requiresUpgrade,
  showPaywall,
}: {
  showConversions?: boolean;
  totalEvents?: { [key in AnalyticsResponseOptions]: number };
  percentageChanges?: { [key in AnalyticsResponseOptions]?: number | null };
  tab: Tab["id"];
  tabHref: (id: Tab["id"]) => string;
  saleUnit: AnalyticsSaleUnit;
  setSaleUnit: (saleUnit: AnalyticsSaleUnit) => void;
  requiresUpgrade?: boolean;
  showPaywall?: boolean;
}) {
  // Debug percentage changes
  console.log("AnalyticsTabs - percentageChanges received:", percentageChanges);
  console.log("AnalyticsTabs - totalEvents received:", totalEvents);
  const tabs = useMemo(
    () =>
      [
        {
          id: "clicks",
          label: "Visitors",
          colorClassName: "text-blue-500/50",
          conversions: false,
        },
        {
          id: "bounce_rate",
          label: "Bounce Rate",
          colorClassName: "text-red-500/50",
          conversions: false,
        },
        {
          id: "avg_session_duration",
          label: "Avg. Session Duration",
          colorClassName: "text-green-500/50",
          conversions: false,
        },
        // {
        //   id: "live_visitors",
        //   label: "Online",
        //   colorClassName: "text-blue-500/50",
        //   conversions: false,
        // },
      ] as Tab[],
    [showConversions]
  );

  return (
    <div className="flex overflow-y-hidden">
      <NumberFlowGroup>
        {tabs.map(({ id, label, colorClassName }, idx) => {
          return (
            <div key={id} className="relative z-0">
              <Link
                className={cn(
                  " relative block h-full min-w-[110px] flex-none px-4 py-3 sm:min-w-[150px] ",
                  "transition-colors hover:bg-neutral-50 focus:outline-none active:bg-neutral-100",
                  "ring-inset ring-neutral-500 focus-visible:ring-1 sm:first:rounded-tl-xl"
                )}
                href={tabHref(id)}
                aria-current
              >
                {/* Active tab indicator */}
                {/* <div
                  className={cn(
                    "absolute bottom-0 left-0 h-0.5 w-full bg-black transition-transform duration-100",
                    tab !== id && "translate-y-[3px]" // Translate an extra pixel to avoid sub-pixel issues
                  )}
                /> */}

                <div className="flex items-center gap-2.5 text-[14.5px] text-neutral-500">
                  <span className="font-default font-medium ">{label}</span>
                </div>
              
                <div className=" flex h-12 items-center">
                  {totalEvents?.[id] || totalEvents?.[id] === 0 ? (
                    id === "avg_session_duration" ? (
                      <div
                        className={cn(
                          "text-xl text-neutral-600 font-medium sm:text-2xl",
                          showPaywall && "opacity-30"
                        )}
                      >
                        {formatDuration(totalEvents[id])}
                      </div>
                    ) : (
                      <NumberFlow
                        value={totalEvents[id]}
                        className={cn(
                          "text-xl text-neutral-600 font-medium sm:text-2xl",
                          showPaywall && "opacity-30"
                        )}
                      />
                    )
                  ) : requiresUpgrade ? (
                    <div className="block rounded-full bg-neutral-100 p-2.5">
                      <Lock className="h-4 w-4 text-neutral-500" />
                    </div>
                  ) : (
                    <div className="h-9 w-16 animate-pulse rounded-none bg-neutral-200" />
                  )}
                </div>
                {/* Percentage change badge */}
                {(() => {
                  const change = percentageChanges?.[id];
                  const hasChange = change !== undefined && change !== null;
                  const hasData = totalEvents?.[id] !== undefined;

                  if (!hasChange || !hasData) {
                    console.log(`No change data for ${id}:`, {
                      hasChange,
                      hasData,
                      change,
                      totalEventsValue: totalEvents?.[id],
                    });
                    return null;
                  }

                  const direction = getChangeDirection(change);

                  // Determine colors based on direction
                  let bgColor: string;
                  let textColor: string;
                  let icon: React.ReactNode;

                  if (direction === "up") {
                
                    textColor = "text-[#46AE56]";
                    icon = <ArrowUp className="h-3 w-3" />;
                  } else if (direction === "down") {
                   
                    textColor = "text-[#ff3b30]";
                    icon = <ArrowDown className="h-3 w-3" />;
                  } else {
                    // Neutral - orange/yellow shades
                
                    textColor = "text-[#ff9500]";
                    icon = <span className="text-[#ff9500]">−</span>; // Minus sign for neutral
                  }

                  return (
                    <div className="">
                      <div
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full  text-[13.5px] font-display",
                       
                          textColor
                        )}
                      >
                        {icon}
                        <span>{formatPercentageChange(change)}</span>
                      </div>
                    </div>
                  );
                })()}
              </Link>
            </div>
          );
        })}
      </NumberFlowGroup>
    </div>
  );
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

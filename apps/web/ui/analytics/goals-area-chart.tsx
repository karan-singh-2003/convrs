"use client";

import { Areas, TimeSeriesChart, XAxis, YAxis } from "@repo/ui";
import { cn } from "@repo/utils";
import { nFormatter } from "@repo/utils";
import { formatDateTooltip } from "./format-date-tooltip";
import { useContext } from "react";
import { AnalyticsContext } from "./analytics-providers";
import useWorkspace from "@/lib/swr/use-workspace";

const PALETTE = [
  "text-[#3B82F6]", "text-[#10B981]", "text-[#A855F7]", "text-[#EF4444]",
  "text-[#F59E0B]", "text-[#14B8A6]", "text-[#EC4899]", "text-[#6366F1]",
];

export function GoalsAreaChart({
  chartData,
  goalNames,
  selectedGoal,
  onSelectGoal,
  isLoading,
}: {
  chartData: { date: Date; values: Record<string, number> }[];
  goalNames: string[];
  selectedGoal: string | null;
  /** Called with a goal name to isolate it, or null to reset to "all goals" */
  onSelectGoal?: (goal: string | null) => void;
  isLoading?: boolean;
}) {
  const { interval, start, end } = useContext(AnalyticsContext);
  const { createdAt: workspaceCreatedAt } = useWorkspace();
  const dataAvailableFrom = workspaceCreatedAt ? new Date(workspaceCreatedAt) : undefined;

  const colorFor = (goal: string) =>
    PALETTE[goalNames.indexOf(goal) % PALETTE.length];

  const series = goalNames.map((goal) => ({
    id: goal,
    valueAccessor: (d: any) => d.values[goal] ?? 0,
    isActive: selectedGoal ? goal === selectedGoal : true,
    colorClassName: colorFor(goal),
  }));

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col gap-3 p-1">
        <div className="h-4 w-32 animate-pulse rounded-full bg-bg-subtle" />
        <div className="flex-1 animate-pulse rounded-lg bg-bg-subtle" />
      </div>
    );
  }

  if (goalNames.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 font-display text-center">
        <p className="text-sm font-medium text-content-default">No goals set up yet</p>
        <p className="text-[13px] text-content-subtle">
          Create a goal to start tracking completions over time.
        </p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-content-subtle">
        No goal activity in this period.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Legend: click a goal to isolate its line, click again (or "All") to reset */}
      {/* <div className="flex flex-wrap items-center gap-1.5 px-1">
        <button
          type="button"
          onClick={() => onSelectGoal?.(null)}
          className={cn(
            "rounded-full px-2 py-0.5 text-[12px] font-medium font-alexandria transition-colors",
            !selectedGoal
              ? "bg-bg-emphasis text-content-default"
              : "text-content-subtle hover:bg-bg-subtle"
          )}
        >
          All
        </button>
        {goalNames.map((goal) => (
          <button
            key={goal}
            type="button"
            onClick={() => onSelectGoal?.(selectedGoal === goal ? null : goal)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium font-alexandria transition-colors",
              selectedGoal === goal
                ? "bg-bg-emphasis text-content-default"
                : "text-content-subtle hover:bg-bg-subtle",
              selectedGoal && selectedGoal !== goal && "opacity-40"
            )}
          >
            <span className={cn("size-2 shrink-0 rounded-full", colorFor(goal))} style={{ backgroundColor: "currentColor" }} />
            <span className="max-w-[120px] truncate">{goal}</span>
          </button>
        ))}
      </div> */}

      <div className="min-h-0 flex-1">
        <TimeSeriesChart
          key={selectedGoal ?? "all"}
          data={chartData}
          series={series}
          tooltipContent={(d) => (
            <div className="w-[200px] py-3 px-3 space-y-1.5 font-alexandria">
              <p className="border-b border-border-subtle pb-1 text-[12px] text-content-subtle">
                {formatDateTooltip(d.date, { interval, start, end, dataAvailableFrom })}
              </p>
              {(selectedGoal ? [selectedGoal] : goalNames).map((goal) => (
                <div key={goal} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex items-center gap-1.5 text-content-subtle">
                    <span className={cn("size-2 shrink-0 rounded-full", colorFor(goal))} style={{ backgroundColor: "currentColor" }} />
                    <span className="truncate">{goal}</span>
                  </span>
                  <span className="font-medium text-content-default">{nFormatter(d.values[goal] ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        >
          <XAxis tickFormat={(d) => formatDateTooltip(d, { interval, start, end, dataAvailableFrom })} />
          <YAxis showGridLines tickFormat={(v) => nFormatter(v)} />
          <Areas
            showLatestValueCircle={false}
            seriesStyles={series.map(({ id }) => ({ id, areaFill: "currentColor", areaOpacity: 0.12, lineStroke: "currentColor" }))}
          />
        </TimeSeriesChart>
      </div>
    </div>
  );
}
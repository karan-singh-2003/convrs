// goal-properties-panel.tsx
"use client";

import { useContext, useMemo } from "react";
import { LoadingSpinner } from "@repo/ui";
import { cn, nFormatter } from "@repo/utils";
import { AnalyticsContext } from "./analytics-providers";
import { useAnalyticsFilterOption } from "./use-analytics-filter-option";

export function GoalPropertiesPanel({ goalName }: { goalName: string }) {
  const context = useContext(AnalyticsContext);

  const { data, loading } = useAnalyticsFilterOption(
    { groupBy: "goal_properties" as any, goalName },
    { context }
  );

  const grouped = useMemo(() => {
    if (!data) return null;
    const map: Record<string, { value: string; count: number }[]> = {};
    for (const item of data) {
      const raw = (item as any).goal_property ?? "";
      const splitIdx = raw.indexOf("::");
      const propKey = (item as any).prop_key ?? (splitIdx === -1 ? raw : raw.slice(0, splitIdx));
      const val = splitIdx === -1 ? "" : raw.slice(splitIdx + 2);
      if (!map[propKey]) map[propKey] = [];
      map[propKey].push({ value: val, count: item.clicks ?? 0 });
    }
    return map;
  }, [data]);

  const hasProperties = grouped && Object.keys(grouped).length > 0;

  if (loading) {
    return (
      <div className="flex h-44 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!hasProperties) {
    return (
      <div className="flex h-44 flex-col font-display items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm text-content-subtle">
          No properties recorded for this goal.
        </p>
        <p className="text-[12.5px] text-content-subtle/70">
          Pass props when calling{" "}
          <code className="rounded bg-bg-subtle px-1 py-0.5 font-mono text-[11px]">
            trackEvent
          </code>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-3 sm:px-4">
      {Object.entries(grouped!).map(([propKey, values]) => (
        <PropertyGroup key={propKey} propKey={propKey} values={values} />
      ))}
    </div>
  );
}
function PropertyGroup({
  propKey,
  values,
}: {
  propKey: string;
  values: { value: string; count: number }[];
}) {
  const max = Math.max(...values.map((v) => v.count), 1);
  const total = values.reduce((sum, v) => sum + v.count, 0);

  return (
    <div>
      <p className="mb-2 text-[12px] font-medium font-display tracking-widest text-content-subtle">
        {propKey}
      </p>
      <div className="space-y-0.5">
        {values.map(({ value, count }) => {
          const widthPct = Math.min(100, Math.max(0, (count / max) * 100));
          const sharePct = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;

          return (
            <div
              key={value}
              className="group relative flex h-7 items-center overflow-hidden rounded-none sm:h-8"
            >
              {/* Background bar, full row height, same treatment as BarList rows */}
              <div className="absolute inset-0 -z-10 overflow-hidden rounded-none">
                <div
                  className="h-full bg-bg-bar-primary transition-all duration-300"
                  style={{ width: `${widthPct}%` }}
                />
              </div>

              {/* Label */}
              <span
                className={cn(
                  "relative z-10 min-w-0 flex-1 truncate px-3 font-display text-[13.5px] font-medium text-content-default",
                  "transition-[max-width] duration-300 ease-in-out max-w-[calc(100%-2rem)]",
                  "group-hover:max-w-[calc(100%-5rem)]"
                )}
              >
                {value || (
                  <span className="italic font-display font-medium text-content-subtle">
                    (empty)
                  </span>
                )}
              </span>

              {/* Count — slides left on hover to make room for percentage */}
              <span
                className={cn(
                  "relative z-10 shrink-0 px-2 font-display text-[13px] font-semibold tabular-nums text-content-default transition-transform duration-300 sm:px-3",
                  "group-hover:-translate-x-14"
                )}
              >
                {nFormatter(count, { digits: 1 })}
              </span>

              {/* Percentage — revealed on hover, pinned to the right */}
              <span
                className={cn(
                  "absolute right-0 z-10 px-2 font-display text-[12px] text-content-subtle transition-all duration-300 sm:px-3",
                  "invisible translate-x-14 opacity-0",
                  "group-hover:visible group-hover:translate-x-0 group-hover:opacity-100"
                )}
              >
                {sharePct > 0 ? `${sharePct}%` : "0%"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
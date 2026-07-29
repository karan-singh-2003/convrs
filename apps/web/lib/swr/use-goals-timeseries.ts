// use-goals-timeseries.ts
"use client";

import useSWR from "swr";
import { fetcher } from "@repo/utils";
import { useContext, useMemo } from "react";
import { AnalyticsContext } from "../../ui/analytics/analytics-providers";
import { editQueryString } from "@/lib/analytics/utils";

type GoalRow = { groupByField: string; goal: string; count: number };

export function useGoalsTimeseries() {
  const { baseApiPath, queryString } = useContext(AnalyticsContext);

  const swrKey = useMemo(() => {
    if (!baseApiPath) return null;
    return `${baseApiPath}/goals-timeseries?${editQueryString(queryString, {})}`;
  }, [baseApiPath, queryString]);

  const { data, isLoading } = useSWR<{ data: GoalRow[] }>(swrKey, fetcher);

  const goalNames = useMemo(
    () => Array.from(new Set((data?.data ?? []).map((r) => r.goal))).sort(),
    [data]
  );

  const chartData = useMemo(() => {
    const byDate = new Map<string, { date: Date; values: Record<string, number> }>();
    for (const row of data?.data ?? []) {
      const dateStr = row.groupByField;
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, { date: new Date(dateStr), values: {} });
      }
      byDate.get(dateStr)!.values[row.goal] = row.count;
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  return { chartData, goalNames, isLoading };
}
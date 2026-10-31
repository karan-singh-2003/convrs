"use client";

import React, { useCallback, useContext, useMemo, useState } from "react";
import { useRouterStuff } from "@repo/ui";
import { AnalyticsContext } from "./analytics-providers";
import { useAnalyticsFilterOption } from "./use-analytics-filter-option";
import { SINGULAR_ANALYTICS_ENDPOINTS } from "@/lib/analytics/constants";
import useWorkspace from "@/lib/swr/use-workspace";
import useIntegrations from "@/lib/swr/use-integration";
import { useGoalsTimeseries } from "@/lib/swr/use-goals-timeseries";
import { GoalsCard } from "./goals-card";

export function LowerGrid() {
  const { queryParams, searchParams } = useRouterStuff();
  const { selectedTab, totalEvents } = useContext(AnalyticsContext);
  const { kpiEventName, kpiType } = useWorkspace();
  const [selectedGoalFilterValue, setSelectedGoalFilterValue] = useState<string | null>(null);
  const { chartData, goalNames, isLoading: chartLoading } = useGoalsTimeseries();
  const [tab] = useState<"goals">("goals");
  const { integrations } = useIntegrations();

  const isGoalKpi = kpiType === "goal" && !!kpiEventName;
  const isRevenueKpi = kpiType === "revenue" && integrations.length > 0;
  const kpiConfigured = isRevenueKpi || isGoalKpi;

  const { data } = useAnalyticsFilterOption(tab);
  const { data: allData } = useAnalyticsFilterOption(tab, { omitGroupByFilterKey: true });

  const singularTabName = SINGULAR_ANALYTICS_ENDPOINTS[tab];
  const dataKey = "clicks";
  const kpiLabel = isGoalKpi ? kpiEventName! : "Revenue";

  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const onToggleFilter = useCallback((val: string) => {
    setSelectedItems((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
  }, []);

  const isFilterActive = searchParams.has(singularTabName);
  const activeFilterValues = useMemo(
    () => searchParams.get(singularTabName)?.split(",") ?? [],
    [singularTabName, searchParams]
  );

  const onClearFilter = useCallback(() => {
    setSelectedItems([]);
    if (isFilterActive) queryParams({ del: singularTabName });
  }, [singularTabName, queryParams, isFilterActive]);

  const transformedData = useMemo(
    () =>
      data
        ?.map((d) => ({
          title: d[singularTabName] ?? d.goal,
          filterValue: d[singularTabName] ?? d.goal,
          count: d.clicks || 0,
          revenue: d.revenue || 0,
        }))
        .sort((a, b) => b.count - a.count) ?? [],
    [data, singularTabName]
  );

  const transformedAllData = useMemo(
    () =>
      allData?.map((d) => ({
        title: d[singularTabName] ?? d.goal,
        filterValue: d[singularTabName] ?? d.goal,
        count: d.clicks || 0,
        revenue: d.revenue || 0,
      })) ?? [],
    [allData, singularTabName]
  );

  return (
    <GoalsCard
      chartData={chartData}
      goalNames={goalNames}
      chartLoading={chartLoading}
      selectedGoal={selectedGoalFilterValue}
      onSelectGoal={setSelectedGoalFilterValue}
      data={transformedData}
      allData={transformedAllData}
      totalVisitors={totalEvents?.clicks}
      unit={selectedTab}
      maxValue={Math.max(...(data?.map((d) => d[dataKey] ?? 0) ?? [0]))}
      isFilterActive={isFilterActive}
      selectedItems={selectedItems}
      activeFilterValues={activeFilterValues}
      onToggleFilter={onToggleFilter}
      onClearFilter={onClearFilter}
      onClearSelection={() => setSelectedItems([])}
      kpiLabel={kpiLabel}
      isGoalKpi={isGoalKpi}
      kpiConfigured={kpiConfigured}
      barBackground="bg-bg-bar-primary"
      hoverBackground="hover:bg-bg-subtle"
    />
  );
}

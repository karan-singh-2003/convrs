"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouterStuff } from "@repo/ui";
import { AnalyticsCard } from "./analytics-card";
import { BarList } from "./bar-list";
import { LoadingSpinner } from "@repo/ui";
import { AnalyticsContext } from "./analytics-providers";
import { useAnalyticsFilterOption } from "./use-analytics-filter-option";
import { SINGULAR_ANALYTICS_ENDPOINTS } from "@/lib/analytics/constants";

export function LowerGrid() {
  const { queryParams, searchParams } = useRouterStuff();
  const { selectedTab } = useContext(AnalyticsContext);

  const [tab, setTab] = useState<"goals">("goals");

  const { data } = useAnalyticsFilterOption(tab);
  const { data: allData } = useAnalyticsFilterOption(tab, {
    omitGroupByFilterKey: true,
  });

  const singularTabName = SINGULAR_ANALYTICS_ENDPOINTS[tab];
  const dataKey = "clicks";

  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    setSelectedItems([]);
  }, [tab]);

  const onToggleFilter = useCallback((val: string) => {
    setSelectedItems((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }, []);

  const onApplyFilterValues = useCallback(
    (values: string[]) => {
      if (values.length === 0) {
        queryParams({ del: singularTabName });
      } else {
        queryParams({ set: { [singularTabName]: values.join(",") } });
      }
      setSelectedItems([]);
    },
    [singularTabName, queryParams]
  );

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
          value: d[dataKey] || 0,
        }))
        .sort((a, b) => b.value - a.value) ?? [],
    [data, singularTabName, dataKey]
  );

  const transformedAllData = useMemo(
    () =>
      allData
        ?.map((d) => ({
          title: d[singularTabName] ?? d.goal,
          filterValue: d[singularTabName] ?? d.goal,
          value: d[dataKey] || 0,
        }))
        .sort((a, b) => b.value - a.value) ?? [],
    [allData, singularTabName, dataKey]
  );

  return (
    <AnalyticsCard
      tabs={[{ id: "goals", label: "Goals" }]}
      selectedTabId={tab}
      onSelectTab={setTab}
      expandLimit={8}
      dataLength={data?.length}
      isFilterActive={isFilterActive}
      onClearFilter={onClearFilter}
    >
      {({ limit, setShowModal }) =>
        data ? (
          data.length > 0 ? (
            <BarList
              tab={singularTabName}
              data={transformedData}
              allData={transformedAllData}
              unit={selectedTab}
              maxValue={Math.max(...data.map((d) => d[dataKey] ?? 0)) ?? 0}
              barBackground="bg-purple-100"
              hoverBackground="hover:bg-gradient-to-r hover:from-purple-50 hover:to-transparent hover:border-purple-500"
              filterSelectedBackground="bg-purple-600"
              filterSelectedHoverBackground="hover:bg-purple-700"
              filterHoverClass="bg-white border border-purple-200"
              setShowModal={setShowModal}
              selectedFilterValues={selectedItems}
              activeFilterValues={activeFilterValues}
              onToggleFilter={onToggleFilter}
              onClearFilter={onClearFilter}
              onClearSelection={() => setSelectedItems([])}
              onRowFilterItem={(val) => onApplyFilterValues([val])}
              onApplyFilterValues={onApplyFilterValues}
              {...(limit && { limit })}
            />
          ) : (
            <div className="flex h-[250px] items-center justify-center sm:h-[300px]">
              <p className="text-xs font-poppins text-neutral-500 sm:text-[13px] font-medium">
                No data available
              </p>
            </div>
          )
        ) : (
          <div className="absolute inset-0 flex h-[250px] w-full items-center justify-center bg-white/50 sm:h-[300px]">
            <LoadingSpinner />
          </div>
        )
      }
    </AnalyticsCard>
  );
}

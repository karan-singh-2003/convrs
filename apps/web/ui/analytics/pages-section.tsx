"use client";

import { SINGULAR_ANALYTICS_ENDPOINTS } from "@/lib/analytics/constants";
import { useRouterStuff } from "@repo/ui";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnalyticsCard } from "./analytics-card";
import { LoadingSpinner } from "@repo/ui";
import { AnalyticsContext } from "./analytics-providers";
import { BarList } from "./bar-list";
import { useAnalyticsFilterOption } from "./use-analytics-filter-option";

export function PagesSection() {
  const { queryParams, searchParams } = useRouterStuff();

  const { selectedTab, saleUnit } = useContext(AnalyticsContext);
  const dataKey = selectedTab === "revenue" ? "revenue" : "count";

  const [tab, setTab] = useState<
    "hostname" | "page" | "entrypage" | "exitlink"
  >("hostname");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { data } = useAnalyticsFilterOption({
    groupBy: tab,
  });
  const { data: allData } = useAnalyticsFilterOption(
    { groupBy: tab },
    { omitGroupByFilterKey: true }
  );

  const singularTabName = SINGULAR_ANALYTICS_ENDPOINTS[tab];

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

  return (
    <AnalyticsCard
      tabs={[
        { id: "hostname", label: "Hostname" },
        { id: "page", label: "Page" },
        { id: "entrypage", label: "Entry Page" },
        { id: "exitlink", label: "Exit Link" },
      ]}
      selectedTabId={tab}
      onSelectTab={setTab}
      expandLimit={8}
      dataLength={data?.length}
      isFilterActive={isFilterActive}
      onClearFilter={onClearFilter}
    >
      {({ limit, setShowModal }) => (
        <>
          {data ? (
            data.length > 0 ? (
              <BarList
                tab={singularTabName}
                data={
                  data
                    ?.map((d) => ({
                      title: d[singularTabName],
                      filterValue: d[singularTabName],
                      value: d[dataKey] || 0,
                    }))
                    ?.sort((a, b) => b.value - a.value) || []
                }
                allData={allData
                  ?.map((d) => ({
                    title: d[singularTabName],
                    filterValue: d[singularTabName],
                    value: d[dataKey] || 0,
                  }))
                  ?.sort((a, b) => b.value - a.value)}
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
                onApplyFilterValues={onApplyFilterValues}
                {...(limit && { limit })}
              />
            ) : (
              <div className="flex h-[250px] items-center justify-center sm:h-[300px]">
                <p className="text-xs text-neutral-500 sm:text-sm font-medium font-default">
                  No data available
                </p>
              </div>
            )
          ) : (
            <div className="absolute inset-0 flex h-[250px] w-full items-center justify-center bg-white/50 sm:h-[300px]">
              <LoadingSpinner />
            </div>
          )}
        </>
      )}
    </AnalyticsCard>
  );
}

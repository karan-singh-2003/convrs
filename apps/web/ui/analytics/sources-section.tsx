import { SINGULAR_ANALYTICS_ENDPOINTS } from "@/lib/analytics/constants";
import { useRouterStuff } from "@repo/ui";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnalyticsCard } from "./analytics-card";
import { LoadingSpinner } from "@repo/ui";
import { AnalyticsContext } from "./analytics-providers";
import { BarList } from "./bar-list";
import { useAnalyticsFilterOption } from "./use-analytics-filter-option";

export function SourcesSection() {
  const { queryParams, searchParams } = useRouterStuff();

  const { selectedTab, saleUnit } = useContext(AnalyticsContext);
  const dataKey = selectedTab === "sales" ? saleUnit : "count";

  const [tab, setTab] = useState<"source" | "referers" | "campaign">("source");
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
        { id: "source", label: "Source" },
        { id: "referers", label: "Referers" },
        { id: "campaign", label: "Campaign" },
        { id: "medium", label: "Medium" },
        { id: "term", label: "Term" },
        { id: "content", label: "Content" },
        { id: "links", label: "Links" },
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
                barBackground="bg-orange-100"
                hoverBackground="hover:bg-gradient-to-r hover:from-orange-50 hover:to-transparent hover:border-orange-500"
                filterSelectedBackground="bg-orange-600"
                filterSelectedHoverBackground="hover:bg-orange-700"
                filterHoverClass="bg-white border border-orange-200"
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
              <div className="flex h-[300px] items-center justify-center">
                <p className="text-sm text-neutral-600">No data available</p>
              </div>
            )
          ) : (
            <div className="absolute inset-0 flex h-[300px] w-full items-center justify-center bg-white/50">
              <LoadingSpinner />
            </div>
          )}
        </>
      )}
    </AnalyticsCard>
  );
}

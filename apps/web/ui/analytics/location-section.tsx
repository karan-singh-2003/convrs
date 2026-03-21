import { useState } from "react";
import { AnalyticsCard } from "./analytics-card";
import { BarList } from "./bar-list";

import { LoadingSpinner } from "@repo/ui";
import { useAnalyticsFilterOption } from "./use-analytics-filter-option";

type LocationFilterItem = {
  value: string;
  count: number;
  code?: string;
};

export default function LocationSection() {
  const [tab, setTab] = useState<"country" | "city" | "regions" | "continents">(
    "country"
  );
  const { data, loading } = useAnalyticsFilterOption(tab);
  console.log("LocationSection - data:", data, "loading:", loading);

  const items = (data as LocationFilterItem[]) || [];
  const maxValue = Math.max(...items.map((item) => item.count), 1);

  // Only show flags for countries
  const showFlags = tab === "country";

  return (
    <AnalyticsCard
      tabs={[
        { id: "country", label: "Country" },
        { id: "city", label: "City" },
        { id: "regions", label: "Regions" },
        { id: "continents", label: "Continents" },
      ]}
      selectedTabId={tab}
      onSelectTab={(newTab) => setTab(newTab as typeof tab)}
    >
      {({ setShowModal }) => (
        <div className="p-4">
          {loading ? (
            <div className="flex h-[300px] items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : data && data.length > 0 ? (
            <BarList
              data={data.map((item) => ({
                icon: showFlags ? (
                  <img
                    src={`https://hatscripts.github.io/circle-flags/flags/${item.value?.toLowerCase()}.svg`}
                    alt={item.value}
                    className="size-5 rounded-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : undefined,
                title: item.value,
                value: item.count,
              }))}
              maxValue={maxValue}
              barBackground="bg-neutral-100"
              hoverBackground="hover:bg-neutral-50"
              setShowModal={setShowModal}
            />
          ) : (
            <div className="flex h-[300px] items-center justify-center">
              <p className="text-[13px] font-default text-neutral-600">
                No data available
              </p>
            </div>
          )}
        </div>
      )}
    </AnalyticsCard>
  );
}

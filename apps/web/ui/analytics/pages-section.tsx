import { AnalyticsCard } from "./analytics-card";
import { useState } from "react";
import { BarList } from "./bar-list";

import { LoadingSpinner } from "@repo/ui";
import { useAnalyticsFilterOption } from "./use-analytics-filter-option";

type PageFilterItem = {
  value: string;
  count: number;
};

export default function PagesSection() {
  const [tab, setTab] = useState<"page">("page");
  const { data, loading } = useAnalyticsFilterOption(tab);
  console.log("PagesSection - data:", data, "loading:", loading);

  const items = (data as PageFilterItem[]) || [];
  const maxValue = Math.max(...items.map((item) => item.count), 1);

  return (
    <AnalyticsCard
      tabs={[
        { id: "page", label: "Page" },
        { id: "hostname", label: "Hostname" },
        { id: "entrypage", label: "Entry Page" },
        { id: "exitpage", label: "Exit Page" },
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
              <p className="text-[13px] font-default text-neutral-600">No data available</p>
            </div>
          )}
        </div>
      )}
    </AnalyticsCard>
  );
}

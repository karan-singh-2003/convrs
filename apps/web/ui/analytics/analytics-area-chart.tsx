"use client";

import { TimeSeriesChart, Areas, XAxis, YAxis } from "@repo/ui";
import { subDays } from "date-fns";

const DEMO_DATA = Array.from({ length: 20 }).map((_, i) => {
  const value = Math.floor(200 + Math.random() * 200);

  return {
    date: subDays(new Date(), 19 - i),
    values: {
      people: value,
      revenue: value * 10,
      views: value + 100,
      cr: Math.random() * 10,
      bounced: value / 2,
      duration: value * 3,
    },
  };
});

export function AnalyticsAreaChart() {
  const series = [
    {
      id: "people",
      valueAccessor: (d: any) => d.values.people,
      colorClassName: "text-blue-500",
      isActive: true,
    },
    {
      id: "views",
      valueAccessor: (d: any) => d.values.views,
      colorClassName: "text-violet-500",
      isActive: false,
    },
  ];

  return (
    <div className="h-96 w-full">
      <TimeSeriesChart data={DEMO_DATA} series={series}>
        <Areas />
        <XAxis
          tickFormat={(d: Date) =>
            d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          }
        />
        <YAxis />
      </TimeSeriesChart>
    </div>
  );
}

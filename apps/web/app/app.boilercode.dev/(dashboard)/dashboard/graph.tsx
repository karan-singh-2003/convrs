"use client";

import { editQueryString } from "@/lib/analytics/utils";
import {
  Areas,
  TimeSeriesChart,
  XAxis,
  YAxis,
} from "@repo/ui";
import { fetcher, nFormatter } from "@repo/utils";
import { useMemo } from "react";
import useSWR from "swr";

type GraphPoint = {
  date: Date;
  values: {
    visitors: number;
  };
};

type TimeseriesResponse = {
  data: Array<{
    start: string;
    clicks: number;
  }>;
};

function getNiceUpperBound(value: number): number {
  if (value <= 0) return 100;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;

  if (normalized <= 1) return 1 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function getYAxisTickValues(data: GraphPoint[]): number[] {
  const maxVisitors = Math.max(
    ...data.map((point) => point.values.visitors),
    0
  );

  const paddedMax = maxVisitors * 1.08;
  const upperBound = getNiceUpperBound(paddedMax);

  return [0, upperBound]; // ✅ only two values
}

export default function DashboardGraph({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const baseApiPath = `/api/workspaces/${workspaceId}/analytics`;

  const queryString = useMemo(
    () =>
      new URLSearchParams({
        event: "clicks",
        interval: "30d",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }).toString(),
    []
  );

  const { data: response, error, isLoading } = useSWR<TimeseriesResponse>(
    `${baseApiPath}?${editQueryString(queryString, {
      groupBy: "timeseries",
    })}`,
    fetcher,
    {
      shouldRetryOnError: false,
      revalidateOnFocus: false,
    }
  );

  const chartData = useMemo(
    () =>
      response?.data?.map(({ start, clicks }) => ({
        date: new Date(start),
        values: { visitors: clicks },
      })) ?? [],
    [response]
  );

  const yTickValues = useMemo(
    () => getYAxisTickValues(chartData),
    [chartData]
  );

  if (error) {
    return (
      <div className="flex h-[150px] items-center justify-center text-sm text-red-500">
        Failed to load data
      </div>
    );
  }

  if (isLoading && chartData.length === 0) {
    return (
      <div className="h-[150px] animate-pulse rounded-lg bg-neutral-100" />
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex h-[150px] items-center justify-center text-sm text-neutral-400">
        No data
      </div>
    );
  }

  const first = chartData[0].values.visitors;
  const latest = chartData.at(-1)?.values.visitors ?? 0;

  const delta = latest - first;
  const deltaPct = first > 0 ? (delta / first) * 100 : 0;
  const isPositive = delta >= 0;

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="flex items-center px-1 justify-between">
        <div>
          <p className="text-[14.5px] font-default text-neutral-500">Visitors</p>
          <p className="text-xl font-semibold text-neutral-800">
            {nFormatter(latest)}
          </p>
        </div>

        <span
          className={`rounded-full font-display px-2 py-0.5 text-[13px] font-medium ${
            isPositive
              ? " text-[#46AE56]"
              : " text-rose-700"
          }`}
        >
          {isPositive ? "+" : ""}
          {deltaPct.toFixed(1)}%
        </span>
      </div>

      {/* Chart */}
      <div className="h-[120px] w-full rounded-lg bg-neutral-50 p-1">
        <TimeSeriesChart
          data={chartData}
          series={[
            {
              id: "visitors",
              valueAccessor: (d) => d.values.visitors,
              isActive: true,
              colorClassName: "text-violet-600",
            },
          ]}
        >
          <Areas />
          <XAxis
            tickFormat={(date) =>
              new Date(date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
          />
          <YAxis
            tickValues={yTickValues}
            numTicks={3}
            showGridLines
            tickFormat={nFormatter}
            
          />
        </TimeSeriesChart>
      </div>
    </div>
  );
}
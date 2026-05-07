"use client";

import { editQueryString } from "@/lib/analytics/utils";
import { Areas, TimeSeriesChart, XAxis, YAxis } from "@repo/ui";
import { fetcher, nFormatter } from "@repo/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
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
        interval: "24h",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }).toString(),
    []
  );

  const {
    data: response,
    error,
    isLoading,
  } = useSWR<TimeseriesResponse>(
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

  const yTickValues = useMemo(() => getYAxisTickValues(chartData), [chartData]);

  if (error) {
    return (
      <div className="flex h-[150px] font-medium font-display items-center justify-center text-sm text-red-500">
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

  const totalVisitors = chartData.reduce(
    (sum, point) => sum + point.values.visitors,
    0
  );
  const latest = chartData.at(-1)?.values.visitors ?? 0;
  const previous = chartData.at(-2)?.values.visitors ?? latest;

  const delta = latest - previous;
  const deltaPct = previous > 0 ? (delta / previous) * 100 : 0;
  const trend = delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  const trendClasses =
    trend === "up"
      ? " text-[#46AE56]"
      : trend === "down"
        ? " text-rose-700"
        : " text-neutral-500";

  return (
    <div className="space-y-4 p-2 sm:space-y-6 sm:p-3">
      {/* Metrics */}
      <div className="flex items-center gap-y-2 px-1">
        <div>
          <p className="text-[12px] font-medium font-default text-neutral-500 sm:text-[14px]">
            Visitors
          </p>
          <div className="my-1 flex items-end">
            <p className="text-2xl font-semibold text-neutral-800 sm:text-3xl">
              {nFormatter(totalVisitors)}
            </p>
            {/* <span
              className={`rounded-full flex items-center font-display px-2 py-0.5 text-[15px] font-medium ${trendClasses}`}
            >
              {trend === "up" ? (
                <ArrowUpRight />
              ) : trend === "down" ? (
                <ArrowDownRight />
              ) : null}
              {deltaPct.toFixed(1)}%
            </span> */}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[110px] w-full rounded-lg bg-neutral-50 p-1 sm:h-[120px]">
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
            tickLabelClassName="text-[10px] sm:text-[11px]"
          />
          <YAxis
            tickValues={yTickValues}
            numTicks={3}
            showGridLines
            tickFormat={nFormatter}
            tickLabelClassName="text-[10px] sm:text-[11px]"
          />
        </TimeSeriesChart>
      </div>
    </div>
  );
}

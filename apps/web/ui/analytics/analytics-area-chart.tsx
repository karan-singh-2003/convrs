"use client";

import { formatDateTooltip } from "./format-date-tooltip";
import { EventType } from "@/lib/analytics/types";
import { editQueryString } from "@/lib/analytics/utils";
import useWorkspace from "@/lib/swr/use-workspace";
import { Areas, TimeSeriesChart, XAxis, YAxis } from "@repo/ui";
import { currencyFormatter, fetcher, nFormatter } from "@repo/utils";
import { subDays } from "date-fns";
import { Fragment, useContext, useMemo } from "react";
import useSWR from "swr";
import { LoadingSpinner } from "@repo/ui";
import { AnalyticsContext } from "./analytics-providers";

const DEMO_DATA = [
  180, 230, 320, 305, 330, 290, 340, 310, 380, 360, 270, 360, 280, 270, 350,
  370, 350, 340, 300,
]
  .reverse()
  .map((value, index) => ({
    date: subDays(new Date(), index),
    values: {
      clicks: value,
      revenue: value * 19,
      leads: value,
      sales: value,
      saleAmount: value * 19,
    },
  }))
  .reverse();

function lowercaseAmPm(value: string) {
  return value.replace(/\bAM\b/g, "am").replace(/\bPM\b/g, "pm");
}

function formatRevenueDollars(value: number) {
  return Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function AnalyticsAreaChart({
  resource,
  demo,
}: {
  resource: EventType;
  demo?: boolean;
}) {
  const { createdAt: workspaceCreatedAt } = useWorkspace();

  const dataAvailableFrom = [workspaceCreatedAt]
    .filter(Boolean)
    .reduce(
      (earliest, current) =>
        !earliest || (current && new Date(current) < new Date(earliest))
          ? current
          : earliest,
      null
    ) as Date;

  const {
    baseApiPath,
    queryString,
    start,
    end,
    interval,
    saleUnit,
    requiresUpgrade,
  } = useContext(AnalyticsContext);

  const {
    data: response,
    error,
    isLoading,
  } = useSWR<{
    data: Array<{
      start: string;
      clicks: number;
      revenue: number;
      leads: number;
      sales: number;
      saleAmount: number;
    }>;
  }>(
    !demo &&
      `${baseApiPath}?${editQueryString(queryString, {
        groupBy: "timeseries",
      })}`,
    fetcher
  );

  const chartData = useMemo(
    () =>
      demo
        ? DEMO_DATA
        : response?.data && Array.isArray(response.data)
          ? response.data.map(
              ({ start, clicks, revenue, leads, sales, saleAmount }) => ({
                date: new Date(start),
                values: {
                  clicks,
                  revenue,
                  leads,
                  sales,
                  saleAmount,
                },
              })
            )
          : null,
    [response, demo]
  );

  const safeChartData = useMemo(
    () =>
      (chartData ?? []).filter(
        (item) =>
          item.date instanceof Date && !Number.isNaN(item.date.getTime())
      ),
    [chartData]
  );

  const series = [
    {
      id: "clicks",
      valueAccessor: (d) => d.values.clicks,
      isActive: resource === "clicks",
      colorClassName: "text-[#7D53E0]",
    },
    {
      id: "revenue",
      valueAccessor: (d) => d.values.revenue,
      isActive: resource === "revenue",
      colorClassName: "text-[#0f9d58]",
    },
  ];

  const activeSeries = series.find(({ id }) => id === resource);
  const tooltipLabel = resource === "clicks" ? "Visitors" : "Revenue";
  const showInitialLoader = !demo && isLoading && !response;
  const hasChartData = safeChartData.length > 0;

  return (
    <div className="flex h-full  w-full items-center justify-center">
      {showInitialLoader ? (
        <div className="w-full h-[464px]  bg-neutral-50 space-y-2">
       
        </div>
      ) : !hasChartData ? (
        <p className="text-sm font-default text-neutral-500">
          No analytics data yet.
        </p>
      ) : (
        <TimeSeriesChart
          key={queryString}
          data={safeChartData}
          series={series}
          defaultTooltipIndex={demo ? DEMO_DATA.length - 2 : undefined}
          tooltipClassName="p-0 px-10"
          tooltipContent={(d) => {
            return (
              <div className="w-[130px] py-3   space-y-2">
                <p className="text-[13px] font-poppins font-medium text-neutral-500">
                  {lowercaseAmPm(
                    formatDateTooltip(d.date, {
                      interval: demo ? "day" : interval,
                      start,
                      end,
                      dataAvailableFrom,
                    })
                  )}
                </p>
                <div className=" text-sm">
                  <Fragment key={resource}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display font-medium text-[18px] text-neutral-600">
                        {tooltipLabel}
                      </p>
                      <h1 className="font-display text-[18px] font-medium text-neutral-600">
                        {resource === "revenue"
                          ? formatRevenueDollars(
                              activeSeries?.valueAccessor(d) ?? d.values.revenue
                            )
                          : nFormatter(
                              activeSeries?.valueAccessor(d) ?? d.values.clicks
                            )}
                      </h1>
                    </div>
                  </Fragment>
                </div>
              </div>
            );
          }}
        >
          <Areas
            showLatestValueCircle={false}
            seriesStyles={[
              {
                id: "clicks",
                areaFill: "transparent",
                lineStroke: "currentColor",
              },
              {
                id: "revenue",
                areaFill: "transparent",
                lineStroke: "currentColor",
              },
            ]}
          />
          <XAxis
            tickFormat={(d) =>
              lowercaseAmPm(
                formatDateTooltip(d, {
                  interval,
                  start,
                  end,
                  dataAvailableFrom,
                })
              )
            }
          />
          <YAxis
            showGridLines
            tickFormat={(val) =>
              resource === "revenue"
                ? formatRevenueDollars(val)
                : nFormatter(val)
            }
          />
        </TimeSeriesChart>
      )}
    </div>
  );
}

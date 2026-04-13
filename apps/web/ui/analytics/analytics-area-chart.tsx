import { formatDateTooltip } from "./format-date-tooltip";
import { EventType } from "@/lib/analytics/types";
import { editQueryString } from "@/lib/analytics/utils";
import useWorkspace from "@/lib/swr/use-workspace";
import { Areas, TimeSeriesChart, XAxis, YAxis } from "@repo/ui";
import { cn, currencyFormatter, fetcher, nFormatter } from "@repo/utils";
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
      leads: value,
      sales: value,
      saleAmount: value * 19,
    },
  }))
  .reverse();

function lowercaseAmPm(value: string) {
  return value.replace(/\bAM\b/g, "am").replace(/\bPM\b/g, "pm");
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

  const { data: response } = useSWR<{
    data: Array<{
      start: string;
      clicks: number;
      leads: number;
      sales: number;
      saleAmount: number;
    }>;
  }>(
    !demo &&
      `${baseApiPath}?${editQueryString(queryString, {
        groupBy: "timeseries",
      })}`,
    fetcher,
    {
      shouldRetryOnError: !requiresUpgrade,
    }
  );

  const chartData = useMemo(
    () =>
      demo
        ? DEMO_DATA
        : response?.data && Array.isArray(response.data)
          ? response.data.map(
              ({ start, clicks, leads, sales, saleAmount }) => ({
                date: new Date(start),
                values: {
                  clicks,
                  leads,
                  sales,
                  saleAmount,
                },
              })
            )
          : null,
    [response, demo]
  );

  const series = [
    {
      id: "clicks",
      valueAccessor: (d) => d.values.clicks,
      isActive: resource === "clicks",
      colorClassName: "text-[#7D53E0]",
    },
  ];

  const activeSeries = series.find(({ id }) => id === resource);
  const tooltipLabel = resource === "clicks" ? "Visitors" : resource;

  return (
    <div className="flex h-full px-10 w-full items-center justify-center">
      {chartData ? (
        <TimeSeriesChart
          key={queryString}
          data={chartData}
          series={series}
          defaultTooltipIndex={demo ? DEMO_DATA.length - 2 : undefined}
          tooltipClassName="p-0"
          tooltipContent={(d) => {
            return (
              <div className="w-[200px] p-4 space-y-2">
                <p className="text-sm font-default font-medium text-neutral-500">
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
                      <p className="font-display text-base text-neutral-500">
                        {tooltipLabel}
                      </p>
                      <h1 className="font-display text-[18px] font-medium text-neutral-700">
                        {nFormatter(
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
          <YAxis showGridLines tickFormat={nFormatter} />
        </TimeSeriesChart>
      ) : (
        <LoadingSpinner />
      )}
    </div>
  );
}

import { tb } from "@/lib/tinybird";
import * as z from "zod/v4";
import { analyticsFilterTB } from "../zod/schemas/analytics";
import { analyticsResponse } from "../zod/schemas/analytics-response";
import { SINGULAR_ANALYTICS_ENDPOINTS } from "./constants";
import { buildAdvancedFilters, prepareFiltersForPipe } from "./filter-helpers";
import { AnalyticsFilters } from "./types";
import { formatUTCDateTimeClickhouse } from "./utils/format-utc-date-time-clickhouse";
import { getStartEndDates } from "./utils/get-start-and-end-dates";

// Fetch data from Tinybird analytics pipes
export const getAnalytics = async (params: AnalyticsFilters) => {
  const {
    event,
    groupBy,
    workspaceId,
    interval,
    start,
    end,
    trigger,
    region,
    country,
    timezone = "UTC",
    dataAvailableFrom,
  } = params;

  const { startDate, endDate, granularity } = getStartEndDates({
    interval,
    start,
    end,
    dataAvailableFrom,
    timezone,
  });

  const { triggerForPipe, countryForPipe, regionForPipe } =
    prepareFiltersForPipe({
      trigger,
      region,
      country,
    });

  // Create a Tinybird pipe
  const pipe = tb.buildPipe({
    pipe: ["count", "timeseries"].includes(groupBy!)
      ? `v1_${groupBy}`
      : "v1_group_by",
    parameters: analyticsFilterTB,
    data: z.object({
      groupByField: z.string().optional(),
      clicks: z.number().nullable().default(0),
      bounce_rate: z.number().nullable().default(0),
      avg_session_duration: z.number().nullable().default(0),
      saleAmount: z.number().nullable().default(0),
      country: z.string().optional(),
      region: z.string().optional(),
    }),
  });

  const advancedFilters = buildAdvancedFilters({
    ...params,
    country: countryForPipe,
    trigger: triggerForPipe,
  });

  console.log(advancedFilters);

  const tinybirdParams: any = {
    workspaceId,
    groupBy,
    eventType: event,
    start: formatUTCDateTimeClickhouse(startDate),
    end: formatUTCDateTimeClickhouse(endDate),
    granularity,
    timezone,
    region: typeof regionForPipe === "string" ? regionForPipe : undefined,
    filters:
      advancedFilters.length > 0 ? JSON.stringify(advancedFilters) : undefined,
  };

  console.log("Tinybird params:", tinybirdParams);
  const response = await pipe(tinybirdParams);
  console.log("Tinybird response:", response);

  // Return parsed response
  const schema = analyticsResponse[groupBy!];

  return response.data.map((item: any) =>
    schema.parse({
      ...item,
      [SINGULAR_ANALYTICS_ENDPOINTS[groupBy!]]: item.groupByField,
    })
  );
};

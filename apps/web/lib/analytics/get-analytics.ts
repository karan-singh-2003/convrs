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


  if (event === "funnel") {
    const funnelPipe = tb.buildPipe({
      pipe: "v1_funnel",
      parameters: z.object({
        workspaceId: z.string().min(1),
        steps: z.string().optional(),
      }),
      data: z.object({
        step: z.string(),
        users: z.coerce.number().int().nonnegative(),
      }),
    });

    const rawSteps = (params as any)?.steps;
    const rawStepsCsv = (params as any)?.stepsCsv;

    const normalizedFromArray = Array.isArray(rawSteps)
      ? rawSteps
          .map((step) => String(step).trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];

    const normalizedFromCsv =
      typeof rawStepsCsv === "string" && rawStepsCsv.trim().length > 0
        ? rawStepsCsv
            .split(",")
            .map((step) => step.trim())
            .filter(Boolean)
            .slice(0, 8)
        : [];

    const normalizedSteps =
      normalizedFromArray.length > 0 ? normalizedFromArray : normalizedFromCsv;

    const funnelResponse = await funnelPipe({
      workspaceId: workspaceId as string,
      ...(normalizedSteps.length > 0
        ? { steps: normalizedSteps.join(",") }
        : {}),
    });

    return funnelResponse.data;
  }

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

  const selectedPipe = ["count", "timeseries"].includes(groupBy!)
    ? `v1_${groupBy}`
    : "v1_group_by";

  // v1_count handles composite via count_composite and should not receive
  // eventType='composite', because count_clicks would apply an event_type filter.
  const eventTypeForPipe =
    selectedPipe === "v1_count" && event === "composite" ? undefined : event;

  // Create a Tinybird pipe
  const pipe = tb.buildPipe({
    pipe: selectedPipe,
    parameters: analyticsFilterTB,
    data: z.object({
      groupByField: z.string().optional(),
      clicks: z.number().nullable().default(0),
      bounce_rate: z.number().nullable().default(0),
      avg_session_duration: z.number().nullable().default(0),
      revenue: z.number().nullable().default(0),
      conversion_rate: z.number().nullable().default(0),
      events: z.number().nullable().default(0),
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

  const tinybirdParams: any = {
    workspaceId,
    groupBy,
    eventType: eventTypeForPipe,
    start: formatUTCDateTimeClickhouse(startDate),
    end: formatUTCDateTimeClickhouse(endDate),
    granularity,
    timezone,
    region: typeof regionForPipe === "string" ? regionForPipe : undefined,
    filters:
      advancedFilters.length > 0 ? JSON.stringify(advancedFilters) : undefined,
  };

  const response = await pipe(tinybirdParams);
 
  // Return parsed response
  const schema = analyticsResponse[groupBy!];

  return response.data.map((item: any) => {
    const parsed = schema.parse({
      ...item,
      [SINGULAR_ANALYTICS_ENDPOINTS[groupBy!]]: item.groupByField,
    });

    // Some group-by schemas do not declare revenue yet. Preserve it so revenue views can render values.
    return {
      ...parsed,
      revenue: item?.revenue ?? 0,
    };
  });
};

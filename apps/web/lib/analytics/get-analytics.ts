import { tb } from "@/lib/tinybird";
import * as z from "zod/v4";
import { analyticsFilterTB } from "../zod/schemas/analytics";
import { analyticsResponse } from "../zod/schemas/analytics-response";
import { SINGULAR_ANALYTICS_ENDPOINTS } from "./constants";
import { buildAdvancedFilters, prepareFiltersForPipe } from "./filter-helpers";
import { AnalyticsFilters } from "./types";
import { formatUTCDateTimeClickhouse } from "./utils/format-utc-date-time-clickhouse";
import { getStartEndDates } from "./utils/get-start-and-end-dates";
import { convertCurrency } from "../currency/convert";

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
    goalName,
    currency,
    kpiType,
    kpiEventName,
  } = params;

  const usingCustomKpi = kpiType === "goal" && !!kpiEventName && event === "revenue";
  const kpiGoalName = usingCustomKpi ? kpiEventName : undefined;

  if (event === "funnel") {
    const funnelPipe = tb.buildPipe({
      pipe: "v1_funnel",
      parameters: z.object({
        workspaceId: z.string().min(1),
        steps: z.string().optional(),
        filters: z.string().optional(), // ← add this
        start: z.string().optional(),   // ← add
        end: z.string().optional(),     // ← add
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
    // ← add: build filters the same way the other pipes do
    // compute dates exactly like other pipes do
    const { startDate, endDate } = getStartEndDates({
      interval,
      start,
      end,
      dataAvailableFrom,
      timezone,
    });



    const { triggerForPipe, countryForPipe } = prepareFiltersForPipe({
      trigger,
      country,
      region, // region isn't a filter field in the funnel pipe SQL, just skipped
    });

    const advancedFilters = buildAdvancedFilters({
      ...params,
      country: countryForPipe,
      trigger: triggerForPipe,
    });

    const funnelResponse = await funnelPipe({
      workspaceId: workspaceId as string,
      start: formatUTCDateTimeClickhouse(startDate),
      end: formatUTCDateTimeClickhouse(endDate),
      ...(normalizedSteps.length > 0 ? { steps: normalizedSteps.join(",") } : {}),
      // ← add this
      ...(advancedFilters.length > 0
        ? { filters: JSON.stringify(advancedFilters) }
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
      prop_key: z.string().optional(),
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
      revenue_per_visitor: z.number().nullable().default(0),
      new_visitors: z.number().nullable().default(0),
      returning_visitors: z.number().nullable().default(0),
      new_revenue: z.number().nullable().default(0),
      refund_amount: z.number().nullable().default(0),
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
    ...(goalName && { goalName }),  // ← add
    ...(kpiGoalName && { kpiGoalName }),   // ← add
  };

  // console.log("tinybird params", tinybirdParams)
  const response = await pipe(tinybirdParams);



  // Return parsed response
  const schema = analyticsResponse[groupBy!];

  // return response.data.map((item: any) => {
  //   const parsed = schema.parse({
  //     ...item,
  //     [SINGULAR_ANALYTICS_ENDPOINTS[groupBy!]]: item.groupByField,
  //   });

  //   // Some group-by schemas do not declare revenue yet. Preserve it so revenue views can render values.
  //   return {
  //     ...parsed,
  //     revenue: item?.revenue ?? 0,
  //   };
  // });
  const results = response.data.map((item: any) => {
    const parsed = schema.parse({
      ...item,
      [SINGULAR_ANALYTICS_ENDPOINTS[groupBy!]]: item.groupByField,
    });
    return {
      ...parsed,
      revenue: usingCustomKpi && selectedPipe === "v1_group_by" ? (item?.clicks ?? 0) : (item?.revenue ?? 0),
      conversion_rate: item?.conversion_rate ?? 0,
      bounce_rate: item?.bounce_rate ?? 0,
      avg_session_duration: item?.avg_session_duration ?? 0,
      new_visitors: item?.new_visitors ?? 0,
      returning_visitors: item?.returning_visitors ?? 0,
      new_revenue: item?.new_revenue ?? 0,
      refund_amount: item?.refund_amount ?? 0,
      revenue_per_visitor: item?.revenue_per_visitor ?? 0,
    };
  });



  if (usingCustomKpi || !currency || currency === "USD") {
    return results;
  }

  return Promise.all(
    results.map(async (item) => ({
      ...item,
      revenue: await convertCurrency(item.revenue, "USD", currency),
      ...("saleAmount" in item
        ? { saleAmount: await convertCurrency(item.saleAmount, "USD", currency) }
        : {}),
    }))
  );
};

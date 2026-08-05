// import { tb } from "@/lib/tinybird";
// import * as z from "zod/v4";
// import { analyticsFilterTB } from "../zod/schemas/analytics";
// import { analyticsResponse } from "../zod/schemas/analytics-response";
// import { SINGULAR_ANALYTICS_ENDPOINTS } from "./constants";
// import { buildAdvancedFilters, prepareFiltersForPipe } from "./filter-helpers";
// import { AnalyticsFilters } from "./types";
// import { formatUTCDateTimeClickhouse } from "./utils/format-utc-date-time-clickhouse";
// import { getStartEndDates } from "./utils/get-start-and-end-dates";
// import { convertCurrency } from "../currency/convert";
// import { getBotFilteringAnalytics } from "./get-bot-analytics";

// // Fetch data from Tinybird analytics pipes
// export const getAnalytics = async (params: AnalyticsFilters) => {
//   const {
//     event,
//     groupBy,
//     workspaceId,
//     interval,
//     start,
//     end,
//     trigger,
//     region,
//     country,
//     timezone = "UTC",
//     dataAvailableFrom,
//     goalName,
//     currency,
//     kpiType,
//     kpiEventName,
//   } = params;

//   // const usingCustomKpi = kpiType === "goal" && !!kpiEventName && event === "revenue";
//   // const kpiGoalName = usingCustomKpi ? kpiEventName : undefined;
//   const usingCustomKpi = kpiType === "goal" && !!kpiEventName;
//   const kpiGoalName = usingCustomKpi ? kpiEventName : undefined;

//   if (event === "bot_filtering") {
//     const { startDate, endDate } = getStartEndDates({
//       interval,
//       start,
//       end,
//       dataAvailableFrom,
//       timezone,
//     });

//     return getBotFilteringAnalytics({
//       workspaceId: workspaceId as string,
//       domain: (params as any).domain,
//       category: (params as any).category,
//       groupBy: groupBy as any,
//       interval,
//       start: formatUTCDateTimeClickhouse(startDate),
//       end: formatUTCDateTimeClickhouse(endDate),
//       timezone,
//       dataAvailableFrom,
//     });
//   }
//   if (event === "funnel") {
//     const funnelPipe = tb.buildPipe({
//       pipe: "v1_funnel",
//       parameters: z.object({
//         workspaceId: z.string().min(1),
//         steps: z.string().optional(),
//         filters: z.string().optional(), // ← add this
//         start: z.string().optional(),   // ← add
//         end: z.string().optional(),     // ← add
//       }),
//       data: z.object({
//         step: z.string(),
//         users: z.coerce.number().int().nonnegative(),
//       }),
//     });

//     const rawSteps = (params as any)?.steps;
//     const rawStepsCsv = (params as any)?.stepsCsv;

//     const normalizedFromArray = Array.isArray(rawSteps)
//       ? rawSteps
//         .map((step) => String(step).trim())
//         .filter(Boolean)
//         .slice(0, 8)
//       : [];

//     const normalizedFromCsv =
//       typeof rawStepsCsv === "string" && rawStepsCsv.trim().length > 0
//         ? rawStepsCsv
//           .split(",")
//           .map((step) => step.trim())
//           .filter(Boolean)
//           .slice(0, 8)
//         : [];

//     const normalizedSteps =
//       normalizedFromArray.length > 0 ? normalizedFromArray : normalizedFromCsv;
//     // ← add: build filters the same way the other pipes do
//     // compute dates exactly like other pipes do
//     const { startDate, endDate } = getStartEndDates({
//       interval,
//       start,
//       end,
//       dataAvailableFrom,
//       timezone,
//     });

//     const { triggerForPipe, countryForPipe } = prepareFiltersForPipe({
//       trigger,
//       country,
//       region, // region isn't a filter field in the funnel pipe SQL, just skipped
//     });

//     const advancedFilters = buildAdvancedFilters({
//       ...params,
//       country: countryForPipe,
//       trigger: triggerForPipe,
//     });

//     const funnelResponse = await funnelPipe({
//       workspaceId: workspaceId as string,
//       start: formatUTCDateTimeClickhouse(startDate),
//       end: formatUTCDateTimeClickhouse(endDate),
//       ...(normalizedSteps.length > 0 ? { steps: normalizedSteps.join(",") } : {}),
//       // ← add this
//       ...(advancedFilters.length > 0
//         ? { filters: JSON.stringify(advancedFilters) }
//         : {}),
//     });


//     return funnelResponse.data;
//   }

//   const { startDate, endDate, granularity } = getStartEndDates({
//     interval,
//     start,
//     end,
//     dataAvailableFrom,
//     timezone,
//   });

//   const { triggerForPipe, countryForPipe, regionForPipe } =
//     prepareFiltersForPipe({
//       trigger,
//       region,
//       country,
//     });

//   const selectedPipe = ["count", "timeseries"].includes(groupBy!)
//     ? `v1_${groupBy}`
//     : "v1_group_by";

//   // v1_count handles composite via count_composite and should not receive
//   // eventType='composite', because count_clicks would apply an event_type filter.

//   // const eventTypeForPipe =
//   //   selectedPipe === "v1_count" && event === "composite" ? undefined : event;
//   // new one 
//   const eventTypeForPipe =
//     selectedPipe === "v1_count" && event === "composite"
//       ? undefined
//       : usingCustomKpi
//         ? "revenue"
//         : event;

//   // Create a Tinybird pipe
//   const pipe = tb.buildPipe({
//     pipe: selectedPipe,
//     parameters: analyticsFilterTB,
//     data: z.object({
//       prop_key: z.string().optional(),
//       groupByField: z.string().optional(),
//       clicks: z.number().nullable().default(0),
//       conversions: z.number().nullable().default(0),
//       bounce_rate: z.number().nullable().default(0),
//       avg_session_duration: z.number().nullable().default(0),
//       revenue: z.number().nullable().default(0),
//       conversion_rate: z.number().nullable().default(0),
//       events: z.number().nullable().default(0),
//       saleAmount: z.number().nullable().default(0),
//       country: z.string().optional(),
//       region: z.string().optional(),
//       revenue_per_visitor: z.number().nullable().default(0),
//       new_visitors: z.number().nullable().default(0),
//       returning_visitors: z.number().nullable().default(0),
//       new_revenue: z.number().nullable().default(0),
//       refund_amount: z.number().nullable().default(0),
//     }),
//   });

//   const advancedFilters = buildAdvancedFilters({
//     ...params,
//     country: countryForPipe,
//     trigger: triggerForPipe,
//   });

//   const tinybirdParams: any = {
//     workspaceId,
//     groupBy,
//     eventType: eventTypeForPipe,
//     start: formatUTCDateTimeClickhouse(startDate),
//     end: formatUTCDateTimeClickhouse(endDate),
//     granularity,
//     timezone,
//     region: typeof regionForPipe === "string" ? regionForPipe : undefined,
//     filters:
//       advancedFilters.length > 0 ? JSON.stringify(advancedFilters) : undefined,
//     ...(goalName && { goalName }),  // ← add
//     ...(kpiGoalName && { kpiGoalName }),   // ← add
//   };

//   // console.log("tinybird params", tinybirdParams)
//   const response = await pipe(tinybirdParams);



//   // Return parsed response
//   const schema = analyticsResponse[groupBy!];

//   // return response.data.map((item: any) => {
//   //   const parsed = schema.parse({
//   //     ...item,
//   //     [SINGULAR_ANALYTICS_ENDPOINTS[groupBy!]]: item.groupByField,
//   //   });

//   //   // Some group-by schemas do not declare revenue yet. Preserve it so revenue views can render values.
//   //   return {
//   //     ...parsed,
//   //     revenue: item?.revenue ?? 0,
//   //   };
//   // });
//   const results = response.data.map((item: any) => {
//     const parsed = schema.parse({
//       ...item,
//       [SINGULAR_ANALYTICS_ENDPOINTS[groupBy!]]: item.groupByField,
//     });
//     return {
//       ...parsed,
//       conversions: item?.conversions ?? 0,
//       // revenue: usingCustomKpi && selectedPipe === "v1_group_by" ? (item?.clicks ?? 0) : (item?.revenue ?? 0),
//       // revenue: usingCustomKpi && selectedPipe === "v1_group_by" && event === "revenue"
//       //   ? (item?.clicks ?? 0)
//       //   : (item?.revenue ?? 0),
//       revenue: usingCustomKpi && selectedPipe === "v1_group_by"
//         ? (item?.clicks ?? 0)
//         : (item?.revenue ?? 0),
//       conversion_rate: item?.conversion_rate ?? 0,
//       bounce_rate: item?.bounce_rate ?? 0,
//       avg_session_duration: item?.avg_session_duration ?? 0,
//       new_visitors: item?.new_visitors ?? 0,
//       returning_visitors: item?.returning_visitors ?? 0,
//       new_revenue: item?.new_revenue ?? 0,
//       refund_amount: item?.refund_amount ?? 0,
//       revenue_per_visitor: item?.revenue_per_visitor ?? 0,
//     };
//   });



//   if (usingCustomKpi || !currency || currency === "USD") {
//     return results;
//   }

//   return Promise.all(
//     results.map(async (item) => ({
//       ...item,
//       revenue: await convertCurrency(item.revenue, "USD", currency),
//       ...("saleAmount" in item
//         ? { saleAmount: await convertCurrency(item.saleAmount, "USD", currency) }
//         : {}),
//     }))
//   );
// };


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
import { prisma } from "@repo/db"
// Bot filtering removed — it now lives entirely behind
// /api/analytics/bot-filtering + lib/analytics/get-bot-analytics.ts

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

  const usingCustomKpi = kpiType === "goal" && !!kpiEventName;
  const kpiGoalName = usingCustomKpi ? kpiEventName : undefined;

  if (event === "funnel") {
    const funnelPipe = tb.buildPipe({
      pipe: "v1_funnel",
      parameters: z.object({
        workspaceId: z.string().min(1),
        steps: z.string().optional(),
        filters: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
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
      region,
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

  const eventTypeForPipe =
    selectedPipe === "v1_count" && event === "composite"
      ? undefined
      : usingCustomKpi
        ? "revenue"
        : event;

  const pipe = tb.buildPipe({
    pipe: selectedPipe,
    parameters: analyticsFilterTB,
    data: z.object({
      prop_key: z.string().optional(),
      groupByField: z.string().optional(),
      clicks: z.number().nullable().default(0),
      conversions: z.number().nullable().default(0),
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
    ...(goalName && { goalName }),
    ...(kpiGoalName && { kpiGoalName }),
  };

  const response = await pipe(tinybirdParams);

  const schema = analyticsResponse[groupBy!];

  const results = response.data.map((item: any) => {
    const parsed = schema.parse({
      ...item,
      [SINGULAR_ANALYTICS_ENDPOINTS[groupBy!]]: item.groupByField,
    });
    return {
      ...parsed,
      conversions: item?.conversions ?? 0,
      revenue: usingCustomKpi && selectedPipe === "v1_group_by"
        ? (item?.clicks ?? 0)
        : (item?.revenue ?? 0),
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
    // For referer_urls groupBy, enrich each row with attribution data from
    // Postgres so the frontend can display the real X post URL instead of
    // the raw t.co/... short link.
    if (groupBy === "referer_urls" && workspaceId) {
      return enrichRefererUrlsWithAttribution(results, workspaceId);
    }
    return results;
  }

  const converted = await Promise.all(
    results.map(async (item) => ({
      ...item,
      revenue: await convertCurrency(item.revenue, "USD", currency),
      ...("saleAmount" in item
        ? { saleAmount: await convertCurrency(item.saleAmount, "USD", currency) }
        : {}),
    }))
  );

  if (groupBy === "referer_urls" && workspaceId) {
    return enrichRefererUrlsWithAttribution(converted, workspaceId);
  }

  return converted;
};

// ---------------------------------------------------------------------------
// Attribution enrichment for referer_urls groupBy
// ---------------------------------------------------------------------------
// Queries LinkAttribution rows whose refererUrl matches one of the Tinybird
// result rows. Joins SocialPost (for the real post URL) and SocialAccount
// (for the platform name). Merges `attributedUrl` and `platform` into each
// result row — both fields are undefined when no attribution exists so the
// frontend can safely fall back to the raw refererUrl for display.
// ---------------------------------------------------------------------------

async function enrichRefererUrlsWithAttribution(
  rows: Record<string, any>[],
  workspaceId: string
): Promise<Record<string, any>[]> {
  if (rows.length === 0) return rows;



  // Collect the distinct refererUrl values from the Tinybird result.
  const refererUrls = rows
    .map((r) => r.refererUrl as string | undefined)
    .filter((u): u is string => Boolean(u));

  if (refererUrls.length === 0) return rows;

  // Fetch matching attributions from Postgres. Each unique refererUrl can
  // appear in many click events, but we only need one attribution per URL
  // (the first one found is sufficient for display enrichment).
  const attributions = await prisma.linkAttribution.findMany({
    where: {
      workspaceId,
      refererUrl: { in: refererUrls },
      socialPostId: { not: null },
    },
    select: {
      refererUrl: true,
      socialPost: {
        select: {
          url: true,
          externalId: true,
        },
      },
      socialAccount: {
        select: {
          platform: true,
          handle: true,
          externalId: true,
        },
      },
    },
    distinct: ["refererUrl"],
  });
  
  // Build a lookup: refererUrl → { attributedUrl, platform }
  type AttributionMeta = { attributedUrl: string; platform: string };
  const attributionMap = new Map<string, AttributionMeta>();

  for (const attr of attributions) {
    if (!attr.refererUrl) continue;
    const platform = attr.socialAccount.platform;
    // Prefer SocialPost.url (e.g. "https://x.com/user/status/123").
    // Fall back to reconstructing from handle + externalId for cases where
    // the post URL wasn't recorded (e.g. link-in-bio attributions).
    let attributedUrl = attr.socialPost?.url ?? null;
    if (!attributedUrl && platform === "x") {
      const handle = attr.socialAccount.handle;
      const externalId = attr.socialAccount.externalId;
      if (handle && externalId && !externalId.startsWith("handle:")) {
        attributedUrl = `https://x.com/${handle}/status/${externalId}`;
      }
    }
    if (attributedUrl) {
      attributionMap.set(attr.refererUrl, { attributedUrl, platform });
    }
  }

  // Merge attribution fields into each Tinybird row.
  return rows.map((row) => {
    const meta = row.refererUrl ? attributionMap.get(row.refererUrl) : undefined;
    return meta
      ? { ...row, attributedUrl: meta.attributedUrl, platform: meta.platform }
      : row;
  });
}
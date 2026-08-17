import { tb } from "@/lib/tinybird";
import * as z from "zod/v4";
import { getStartEndDates } from "./utils/get-start-and-end-dates";
import { formatUTCDateTimeClickhouse } from "./utils/format-utc-date-time-clickhouse";

export const BOT_CATEGORIES = [
  "answer_agent",
  "index_crawler",
  "training_crawler",
  "other",
] as const;
export type BotCategory = (typeof BOT_CATEGORIES)[number];

type BotGroupBy = "timeseries" | "providers" | "top_pages" | "categories" | "count";

export interface BotFilteringParams {
  workspaceId: string;
  domain?: string;
  category?: BotCategory;
  groupBy?: BotGroupBy;
  interval?: string;
  start?: string | undefined;
  end?: string | undefined;
  timezone?: string;
  granularity?: "hour" | "day" | "week";
  dataAvailableFrom?: Date;
}

const overviewPipe = tb.buildPipe({
  pipe: "bot_overview_pipe",
  parameters: z.object({
    workspaceId: z.string(),
    domain: z.string().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
  }),
  data: z.object({
    total_requests: z.number(),
    ai_answers: z.number(),
    indexing: z.number(),
    training: z.number(),
    other: z.number(),
    unique_providers: z.number(),
  }),
});

const timeseriesPipe = tb.buildPipe({
  pipe: "bot_timeseries_pipe",
  parameters: z.object({
    workspaceId: z.string(),
    domain: z.string().optional(),
    category: z.string().optional(),
    start: z.string(),
    end: z.string(),
    granularity: z.string().optional(),
  }),
  data: z.object({
    bucket_start: z.string(),
    vendor: z.string(),
    category: z.string(),
    requests: z.number(),
  }),
});

const providersPipe = tb.buildPipe({
  pipe: "bot_providers_pipe",
  parameters: z.object({
    workspaceId: z.string(),
    domain: z.string().optional(),
    category: z.string().optional(),
    start: z.string(),
    end: z.string(),
  }),
  data: z.object({
    vendor: z.string(),
    category: z.string(),
    requests: z.number(),
  }),
});

const topPagesPipe = tb.buildPipe({
  pipe: "bot_top_pages_pipe",
  parameters: z.object({
    workspaceId: z.string(),
    domain: z.string().optional(),
    category: z.string().optional(),
    start: z.string(),
    end: z.string(),
  }),
  data: z.object({
    page: z.string(),
    hostname: z.string(),
    requests: z.number(),
    unique_providers: z.number(),
  }),
});

const categoriesPipe = tb.buildPipe({
  pipe: "bot_categories_pipe",
  parameters: z.object({
    workspaceId: z.string(),
    domain: z.string().optional(),
    start: z.string(),
    end: z.string(),
  }),
  data: z.object({
    category: z.string(),
    requests: z.number(),
  }),
});

/**
 * Handles `event === "bot_filtering"` requests coming through the existing
 * /api/analytics route. Call this from getAnalytics() the same way it already
 * special-cases `event === "funnel"`:
 *
 *   if (event === "bot_filtering") {
 *     return getBotFilteringAnalytics({ ...params, groupBy: params.groupBy as BotGroupBy });
 *   }
 */
export async function getBotFilteringAnalytics(params: BotFilteringParams) {
  const {
    workspaceId,
    domain,
    category,
    groupBy = "count",
    interval,
    start,
    end,
    timezone = "UTC",
    granularity,
    dataAvailableFrom,
  } = params;

  const { startDate, endDate, granularity: computedGranularity } = getStartEndDates({
    interval,
    start,
    end,
    dataAvailableFrom,
    timezone,
  });

  const commonParams = {
    workspaceId,
    ...(domain && { domain }),
    start: formatUTCDateTimeClickhouse(startDate),
    end: formatUTCDateTimeClickhouse(endDate),
  };

  switch (groupBy) {
    // case "timeseries": {
    //   const response = await timeseriesPipe({
    //     ...commonParams,
    //     ...(category && { category }),
    //     granularity: granularity ?? computedGranularity,
    //   });
    //   return pivotTimeseriesByVendor(response.data);
    // }
    case "timeseries": {
      const effectiveGranularity = (granularity ?? computedGranularity) as
        | "hour"
        | "day"
        | "week";

      const response = await timeseriesPipe({
        ...commonParams,
        ...(category && { category }),
        granularity: effectiveGranularity,
      });

      return pivotTimeseriesByVendor(
        response.data,
        startDate,
        endDate,
        effectiveGranularity
      );
    }
    case "providers": {
      const response = await providersPipe({
        ...commonParams,
        ...(category && { category }),
      });
      return withPercentages(response.data);
    }
    case "top_pages": {
      const response = await topPagesPipe({
        ...commonParams,
        ...(category && { category }),
      });
      return response.data;
    }
    case "categories": {
      const response = await categoriesPipe(commonParams);
      return response.data;
    }
    case "count":
    default: {
      const response = await overviewPipe(commonParams);
      return response.data[0] ?? null;
    }
  }
}

/**
 * Converts the pipe's long-format rows (one row per vendor per time bucket)
 * into the wide shape the chart already expects: { start, chatgpt: n, gemini: n, ... }.
 * Vendor keys are derived dynamically, so adding a new bot to the SDK's
 * registry automatically shows up here with no code change required.
 */
// function pivotTimeseriesByVendor(
//   rows: Array<{ bucket_start: string; vendor: string; category: string; requests: number }>
// ) {
//   const byBucket = new Map<string, Record<string, number | string>>();

//   for (const row of rows) {
//     const key = row.bucket_start;
//     if (!byBucket.has(key)) {
//       byBucket.set(key, { start: row.bucket_start });
//     }
//     const bucket = byBucket.get(key)!;
//     const vendorKey = normalizeVendorKey(row.vendor);
//     bucket[vendorKey] = (Number(bucket[vendorKey]) || 0) + row.requests;
//   }

//   return Array.from(byBucket.values()).sort(
//     (a, b) => new Date(a.start as string).getTime() - new Date(b.start as string).getTime()
//   );
// }

function pivotTimeseriesByVendor(
  rows: Array<{ bucket_start: string; vendor: string; category: string; requests: number }>,
  startDate: Date,
  endDate: Date,
  granularity: "hour" | "day" | "week"
) {
  // Which vendors actually appeared in the result set
  const vendorKeys = new Set<string>();
  for (const row of rows) vendorKeys.add(normalizeVendorKey(row.vendor));

  const byBucket = new Map<string, Record<string, number | string>>();

  // Seed every bucket in [startDate, endDate] with 0s for each vendor.
  // This is the important part: without it, a vendor with traffic on only
  // one day produces a single-point series, and a line/area curve
  // (curveMonotoneX) can't draw a line through a single point — you just
  // get an isolated dot instead of a continuous line. Zero-filling
  // guarantees every series has enough points to render properly, no
  // matter how sparse the underlying traffic is.
  for (const bucket of generateBuckets(startDate, endDate, granularity)) {
    const key = formatUTCDateTimeClickhouse(bucket);
    const entry: Record<string, number | string> = { start: key };
    for (const vendorKey of vendorKeys) entry[vendorKey] = 0;
    byBucket.set(key, entry);
  }

  for (const row of rows) {
    // Align each row to its bucket's canonical key so it lands on a
    // seeded bucket instead of creating a duplicate/misaligned entry.
    const bucketDate = floorToGranularity(new Date(row.bucket_start.replace(" ", "T") + "Z"), granularity);
    const key = formatUTCDateTimeClickhouse(bucketDate);

    if (!byBucket.has(key)) {
      byBucket.set(key, { start: key });
    }
    const bucket = byBucket.get(key)!;
    const vendorKey = normalizeVendorKey(row.vendor);
    bucket[vendorKey] = (Number(bucket[vendorKey]) || 0) + row.requests;
  }

  return Array.from(byBucket.values()).sort(
    (a, b) => new Date(a.start as string).getTime() - new Date(b.start as string).getTime()
  );
}

function floorToGranularity(date: Date, granularity: "hour" | "day" | "week"): Date {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  if (granularity === "hour") return d;

  d.setUTCHours(0);
  if (granularity === "day") return d;

  // week: floor to Monday UTC
  const day = d.getUTCDay(); // 0 = Sun ... 6 = Sat
  const diffFromMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diffFromMonday);
  return d;
}

function generateBuckets(start: Date, end: Date, granularity: "hour" | "day" | "week"): Date[] {
  const stepMs =
    granularity === "hour" ? 60 * 60 * 1000 :
    granularity === "week" ? 7 * 24 * 60 * 60 * 1000 :
    24 * 60 * 60 * 1000; // day

  let cursor = floorToGranularity(start, granularity);
  const flooredEnd = floorToGranularity(end, granularity);
  const buckets: Date[] = [];

  while (cursor.getTime() <= flooredEnd.getTime()) {
    buckets.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + stepMs);
  }

  return buckets;
}

function withPercentages<T extends { requests: number }>(rows: T[]) {
  const total = rows.reduce((sum, row) => sum + row.requests, 0);
  return rows.map((row) => ({
    ...row,
    percentage: total > 0 ? Math.round((row.requests / total) * 100) : 0,
  }));
}

export function normalizeVendorKey(vendor: string): string {
  return vendor.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

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
    case "timeseries": {
      const response = await timeseriesPipe({
        ...commonParams,
        ...(category && { category }),
        granularity: granularity ?? computedGranularity,
      });
      return pivotTimeseriesByVendor(response.data);
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
function pivotTimeseriesByVendor(
  rows: Array<{ bucket_start: string; vendor: string; category: string; requests: number }>
) {
  const byBucket = new Map<string, Record<string, number | string>>();

  for (const row of rows) {
    const key = row.bucket_start;
    if (!byBucket.has(key)) {
      byBucket.set(key, { start: row.bucket_start });
    }
    const bucket = byBucket.get(key)!;
    const vendorKey = normalizeVendorKey(row.vendor);
    bucket[vendorKey] = (Number(bucket[vendorKey]) || 0) + row.requests;
  }

  return Array.from(byBucket.values()).sort(
    (a, b) => new Date(a.start as string).getTime() - new Date(b.start as string).getTime()
  );
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

import * as z from "zod/v4";
import { analyticsQuerySchema } from "@/lib/zod/schemas/analytics";
import { parseDateSchema } from "@/lib/zod/schemas/utils";
import { DATE_RANGE_INTERVAL_PRESETS } from "@/lib/analytics/constants";
import { InvalidRequestError } from "./errors";

// "all" is excluded for the public API — an unbounded scan isn't something
// a token-authenticated request should be able to trigger.
export const V1_INTERVALS = DATE_RANGE_INTERVAL_PRESETS.filter(
  (i) => i !== "all"
) as Exclude<(typeof DATE_RANGE_INTERVAL_PRESETS)[number], "all">[];

export const MAX_DATE_RANGE_DAYS = 366;
export const MAX_PAGE_LIMIT = 500;
export const DEFAULT_PAGE_LIMIT = 100;

/**
 * The same filter fields, and the same comma-separated/`-exclude` parsing
 * (parseFilterValue), that the dashboard's own analytics route uses — see
 * lib/zod/schemas/analytics.ts. Kept as a `.pick()` of that schema rather
 * than redeclared so the public API can't drift from the dashboard's filter
 * semantics.
 */
export const v1FilterFields = analyticsQuerySchema.pick({
  country: true,
  city: true,
  region: true,
  continent: true,
  device: true,
  browser: true,
  os: true,
  referer: true,
  refererUrl: true,
  hostname: true,
  page: true,
  entrypage: true,
  exitlink: true,
  utm_source: true,
  utm_medium: true,
  utm_campaign: true,
  utm_term: true,
  utm_content: true,
  goal: true,
  saleType: true,
});

export const v1DateRangeFields = z.object({
  websiteId: z
    .string()
    .optional()
    .describe(
      "The website to retrieve analytics for. Defaults to the website your API token is scoped to; if provided, it must match that website."
    ),
  interval: z
    .enum(V1_INTERVALS as [string, ...string[]])
    .optional()
    .describe(
      `A relative date range shortcut (${V1_INTERVALS.join(", ")}). Ignored when startAt/endAt are provided. Defaults to 30d.`
    ),
  startAt: z
    .string()
    .optional()
    .describe(
      "Start of the date range (ISO 8601 date or datetime). Takes precedence over `interval`."
    ),
  endAt: z
    .string()
    .optional()
    .describe(
      "End of the date range (ISO 8601 date or datetime). Defaults to now."
    ),
  timezone: z
    .string()
    .optional()
    .describe(
      "IANA timezone for aligning day/week/month buckets, e.g. America/New_York. Defaults to UTC."
    ),
});

export const v1PaginationFields = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

type IntervalPreset = (typeof DATE_RANGE_INTERVAL_PRESETS)[number];

export function resolveDateRange({
  interval,
  startAt,
  endAt,
}: {
  interval?: IntervalPreset | string;
  startAt?: string;
  endAt?: string;
}): { start?: Date; end?: Date; interval?: IntervalPreset } {
  if (!startAt) {
    return { interval: (interval as IntervalPreset) ?? "30d" };
  }

  const start = parseDateSchema.parse(startAt);
  const end = endAt ? parseDateSchema.parse(endAt) : new Date();

  if (start > end) {
    throw new InvalidRequestError("`startAt` must be before `endAt`.");
  }

  const rangeDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  if (rangeDays > MAX_DATE_RANGE_DAYS) {
    throw new InvalidRequestError(
      `Date range too large: maximum is ${MAX_DATE_RANGE_DAYS} days.`
    );
  }

  return { start, end };
}

export function paginate<T>(
  rows: T[],
  { page, limit }: { page: number; limit: number }
): { rows: T[]; pagination: { page: number; limit: number; hasMore: boolean } } {
  const offset = (page - 1) * limit;
  const slice = rows.slice(offset, offset + limit);
  return {
    rows: slice,
    pagination: { page, limit, hasMore: offset + slice.length < rows.length },
  };
}

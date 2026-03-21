import {
  DATE_RANGE_INTERVAL_PRESETS,
  EVENT_TYPES,
  OLD_ANALYTICS_ENDPOINTS,
  OLD_TO_NEW_ANALYTICS_ENDPOINTS,
  VALID_ANALYTICS_ENDPOINTS,
} from "@/lib/analytics/constants";
import {
  DEFAULT_PAGINATION_LIMIT,
  DUB_FOUNDING_DATE,
  capitalize,
  formatDate,
  parseFilterValue,
} from "@repo/utils";
import * as z from "zod/v4";
import { booleanQuerySchema } from "./misc";
import { parseDateTime } from "@repo/utils";

export const parseDateSchema = z
  .string()
  .transform((v) => parseDateTime(v))
  .refine((v) => !!v, { message: "Invalid date" });

const analyticsEvents = z
  .enum(
    [
      "visitors",
      "revenue",
      "conversionRate",
      "bounceRate",
      "sessions",
      "online",
      "clicks",
    ],
    {
      error:
        "Invalid event type. Valid event types are: visitors, revenue, conversionRate, bounceRate, sessions, online, clicks",
    }
  )
  .default("visitors")
  .meta({
    description:
      "The type of event to retrieve analytics for. Defaults to `visitors`.",
    example: "visitors",
  });

const analyticsGroupBy = z
  .enum(
    [
      "count",
      "timeseries",
      "country",
      "countries",
      "device",
      "devices",
      "device_type",
      "browser",
      "browsers",
      "os",
      "city",
      "cities",
      "source",
      "page",
      "referrer",
      "referers",
      "campaign",
      "keyword",
      "regions",
      "continents",
      "continent",
      "region",
    ],
    {
      error: `Invalid type value. Valid values are singular (device, browser, country, city, etc.) or plural (devices, browsers, countries, cities, etc.) forms.`,
    }
  )
  .default("count")
  .describe(
    "The parameter to group the analytics data points by. Defaults to `count` if undefined. Accepts both singular and plural forms."
  );

const oldAnalyticsEndpoints = z
  .enum(OLD_ANALYTICS_ENDPOINTS, {
    error: `Invalid type value. Valid values are: ${OLD_ANALYTICS_ENDPOINTS.join(", ")}`,
  })
  .transform((v) => OLD_TO_NEW_ANALYTICS_ENDPOINTS[v] || v);

// For backwards compatibility
export const analyticsPathParamsSchema = z.object({
  eventType: analyticsEvents
    .removeDefault()
    .or(oldAnalyticsEndpoints)
    .optional(),
  endpoint: oldAnalyticsEndpoints.optional(),
});

// Query schema for GET /analytics and GET /events endpoints
export const analyticsQuerySchema = z.object({
  event: analyticsEvents,
  groupBy: analyticsGroupBy,
  interval: z
    .enum(DATE_RANGE_INTERVAL_PRESETS)
    .optional()
    .describe(
      "The interval to retrieve analytics for. If undefined, defaults to 24h."
    ),
  start: parseDateSchema
    .refine((value: Date) => value >= DUB_FOUNDING_DATE, {
      message: `The start date cannot be earlier than ${formatDate(DUB_FOUNDING_DATE)}.`,
    })
    .optional()
    .describe(
      "The start date and time when to retrieve analytics from. If set, takes precedence over `interval`."
    ),
  end: parseDateSchema
    .optional()
    .describe(
      "The end date and time when to retrieve analytics from. If not provided, defaults to the current date. If set along with `start`, takes precedence over `interval`."
    ),
  timezone: z
    .string()
    .optional()
    .describe(
      "The IANA time zone code for aligning timeseries granularity (e.g. America/New_York). Defaults to UTC."
    )
    .meta({ example: "America/New_York", default: "UTC" }),
  // more filter facets
  country: z
    .string()
    .optional()
    .transform(parseFilterValue)
    .describe(
      "The country to retrieve analytics for. Must be passed as a 2-letter ISO 3166-1 country code (see https://d.to/geo). " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`). " +
        "Examples: `US`, `US,BR,FR`, `-US`."
    ),
  city: z
    .string()
    .optional()
    .transform(parseFilterValue)
    .describe(
      "The city to retrieve analytics for. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`). " +
        "Examples: `New York`, `New York,London`, `-New York`."
    ),
  region: z
    .string()
    .optional()
    .describe(
      "The ISO 3166-2 region code to retrieve analytics for. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`). " +
        "Examples: `NY`, `NY,CA`, `-NY`."
    ),
  continent: z
    .string()
    .optional()
    .transform(parseFilterValue)
    .describe(
      "The continent to retrieve analytics for. Valid values: AF, AN, AS, EU, NA, OC, SA. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`). " +
        "Examples: `NA`, `NA,EU`, `-AS`."
    ),
  device: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      // Capitalize each value
      const parsed = parseFilterValue(v);
      if (!parsed) return undefined;
      return {
        ...parsed,
        values: parsed.values
          .map((val) => capitalize(val))
          .filter(Boolean) as string[],
      };
    })
    .describe(
      "The device to retrieve analytics for. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`). " +
        "Examples: `Desktop`, `Mobile,Tablet`, `-Mobile`."
    ),
  browser: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const parsed = parseFilterValue(v);
      if (!parsed) return undefined;
      return {
        ...parsed,
        values: parsed.values
          .map((val) => capitalize(val))
          .filter(Boolean) as string[],
      };
    })
    .describe(
      "The browser to retrieve analytics for. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`). " +
        "Examples: `Chrome`, `Chrome,Firefox,Safari`, `-IE`."
    ),
  os: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const parsed = parseFilterValue(v);
      if (!parsed) return undefined;
      return {
        ...parsed,
        values: parsed.values
          .map((val) => (val === "iOS" ? "iOS" : capitalize(val)))
          .filter(Boolean) as string[],
      };
    })
    .describe(
      "The OS to retrieve analytics for. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`). " +
        "Examples: `Windows`, `Mac,Windows,Linux`, `-Windows`."
    ),
  trigger: z
    .string()
    .optional()
    .transform(parseFilterValue)
    .describe(
      "The trigger to retrieve analytics for. Valid value: pageview. " +
        "If undefined, returns pageview data."
    ),
  referer: z
    .string()
    .optional()
    .transform(parseFilterValue)
    .describe(
      "The referer hostname to retrieve analytics for. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`). " +
        "Examples: `google.com`, `google.com,twitter.com`, `-facebook.com`."
    ),
  refererUrl: z
    .string()
    .optional()
    .transform(parseFilterValue)
    .describe(
      "The full referer URL to retrieve analytics for. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`). " +
        "Examples: `https://google.com`, `https://google.com,https://twitter.com`, `-https://spam.com`."
    ),
  url: z
    .string()
    .optional()
    .transform(parseFilterValue)
    .describe(
      "The destination URL to retrieve analytics for. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`). " +
        "Examples: `https://example.com`, `https://example.com,https://other.com`, `-https://spam.com`."
    ),
  utm_source: z
    .string()
    .optional()
    .transform(parseFilterValue)
    .describe(
      "The UTM source to retrieve analytics for. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`). " +
        "Examples: `google`, `google,twitter`, `-spam`."
    ),
  utm_medium: z
    .string()
    .optional()
    .transform(parseFilterValue)
    .describe(
      "The UTM medium to retrieve analytics for. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`). " +
        "Examples: `cpc`, `cpc,social`, `-email`."
    ),
  utm_campaign: z
    .string()
    .optional()
    .transform(parseFilterValue)
    .describe(
      "The UTM campaign to retrieve analytics for. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`). " +
        "Examples: `summer_sale`, `summer_sale,winter_sale`, `-old_campaign`."
    ),
  utm_term: z
    .string()
    .optional()
    .transform(parseFilterValue)
    .describe(
      "The UTM term to retrieve analytics for. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`)."
    ),
  utm_content: z
    .string()
    .optional()
    .transform(parseFilterValue)
    .describe(
      "The UTM content to retrieve analytics for. " +
        "Supports advanced filtering: single value, multiple values (comma-separated), or exclusion (prefix with `-`)."
    ),
  root: booleanQuerySchema
    .optional()
    .describe(
      "Filter for root domains. If true, filter for domains only. If false, filter for links only. If undefined, return both."
    ),
});

/**
 * Parse analytics/events query parameters with backward compatibility
 */
export function parseAnalyticsQuery(searchParams: Record<string, string>) {
  const data = analyticsQuerySchema.parse(searchParams);
  return data;
}
export function parseEventsQuery(searchParams: Record<string, string>) {
  const data = eventsQuerySchema.parse(searchParams);
  return data;
}

// Analytics filter params for Tinybird endpoints
export const analyticsFilterTB = z.object({
  eventType: analyticsEvents,
  workspaceId: z.string().optional(),
  groupBy: analyticsGroupBy,

  linkId: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(",")))
    .optional()
    .describe(
      "The link IDs to retrieve analytics for (with operator support)."
    ),

  customerId: z.string().optional(),
  start: z.string(),
  end: z.string(),
  granularity: z.enum(["minute", "hour", "day", "month"]).optional(),
  timezone: z.string().optional(),
  // Region is a special case - it's the subdivision part of a region code
  region: z.string().optional(),
  root: z
    .union([z.string(), z.boolean()])
    .transform((v) => {
      if (typeof v === "boolean") return v;
      return v === "true" || v === "1" || v === "yes";
    })
    .optional()
    .describe(
      "Filter for root domain links. True = root only, false = links only. Single value (no operator)."
    ),

  // All dimensional filters now go through the JSON filters parameter
  filters: z
    .string()
    .optional()
    .describe("JSON array of advanced filters with operators (IN, NOT IN)."),
});

export const eventsFilterTB = analyticsFilterTB
  .omit({ granularity: true, timezone: true })
  .and(
    z.object({
      offset: z.coerce.number().default(0),
      limit: z.coerce.number().default(DEFAULT_PAGINATION_LIMIT),
      order: z.enum(["asc", "desc"]).default("desc"),
      sortBy: z.enum(["timestamp"]).default("timestamp"),
    })
  );

const sortOrder = z
  .enum(["asc", "desc"])
  .default("desc")
  .optional()
  .describe("The sort order. The default is `desc`.");

export const eventsQuerySchema = analyticsQuerySchema
  .omit({ groupBy: true })
  .extend({
    event: z
      .enum(EVENT_TYPES)
      .default("clicks")
      .describe(
        "The type of event to retrieve analytics for. Defaults to 'clicks'."
      ),
    page: z.coerce.number().default(1),
    limit: z.coerce
      .number()
      .max(1000, { message: "Max pagination limit is 1000 items per page." })
      .default(DEFAULT_PAGINATION_LIMIT),
    sortOrder,
    sortBy: z
      .enum(["timestamp"])
      .optional()
      .default("timestamp")
      .describe("The field to sort the events by. The default is `timestamp`."),
    order: sortOrder
      .describe("DEPRECATED. Use `sortOrder` instead.")
      .meta({ deprecated: true }),
  });

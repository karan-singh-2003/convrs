import { getStartEndDates } from "./utils/get-start-and-end-dates";
import { tb } from "../tinybird";
import { analyticsFilterTB } from "../zod/schemas/analytics";
import * as z from "zod/v4";
import { formatUTCDateTimeClickhouse } from "./utils/format-utc-date-time-clickhouse";
import { analyticsResponse } from "../zod/schemas/analytics-response";
import { SINGULAR_ANALYTICS_ENDPOINTS } from "./constants";

// Map singular form groupBy values (from UI) to plural forms (for tinybird)
const normalizeSingularToPlural = (groupBy: string): string => {
  const mapping: Record<string, string> = {
    device: "devices",
    country: "countries",
    city: "cities",
    browser: "browsers",
    continent: "continents",
    region: "regions",
    referrer: "referers",
  };
  return mapping[groupBy] || groupBy;
};

export const getAnalytics = async (params) => {
  let {
    groupBy,
    workspaceId,
    interval,
    start,
    end,
    country,
    dataAvailableFrom,
    timezone = "UTC",
    query,
  } = params;

  // Normalize singular groupBy values to plural forms for tinybird compatibility
  const normalizedGroupBy = normalizeSingularToPlural(groupBy);

  const { startDate, endDate, granularity } = getStartEndDates({
    interval,
    start,
    end,
    dataAvailableFrom,
    timezone,
  });

  const pipe = tb.buildPipe({
    pipe: ["count", "timeseries"].includes(groupBy)
      ? `v1_${groupBy}`
      : "v1_group_by",
    parameters: analyticsFilterTB,
    data: z.object({
      groupByField: z
        .string()
        .optional()
        .describe("The field to group by, e.g. country, device, etc."),
    }),
  });

  const response = await pipe({
    ...params,
    groupBy: normalizedGroupBy,
    workspaceId,
    start: formatUTCDateTimeClickhouse(startDate),
    end: formatUTCDateTimeClickhouse(endDate),
    granularity,
    timezone,
  });

  console.log("Analytics response:", response);

  // Handle count and timeseries - these don't have groupByField
  if (["count", "timeseries"].includes(groupBy)) {
    if (groupBy === "count") {
      const { groupByField, ...rest } = response.data[0];
      return rest;
    }
    // For timeseries, return the data as-is (it already has the correct structure)
    return response.data;
  }

  // Handle group by queries - these have groupByField that needs to be renamed
  const schema = analyticsResponse[normalizedGroupBy];

  return response.data.map((item) =>
    schema.parse({
      ...item,
      [SINGULAR_ANALYTICS_ENDPOINTS[normalizedGroupBy]]: item.groupByField,
    })
  );
};

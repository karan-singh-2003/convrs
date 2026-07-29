import z from "zod";
import { AnalyticsFilters } from "./types";
import { formatUTCDateTimeClickhouse } from "./utils/format-utc-date-time-clickhouse";
import { getStartEndDates } from "./utils/get-start-and-end-dates";
import { tb } from "../tinybird";

export const getGoalsTimeseries = async (params: AnalyticsFilters & { goalNames?: string[] }) => {
  const { workspaceId, interval, start, end, timezone = "UTC", dataAvailableFrom, goalNames } = params;
  console.log("params in getgoals ",params)

  if(!workspaceId){
    return null
  }

  const { startDate, endDate, granularity } = getStartEndDates({
    interval, start, end, dataAvailableFrom, timezone,
  });

  const pipe = tb.buildPipe({
    pipe: "v1_goals_timeseries_pipe",
    parameters: z.object({
      workspaceId: z.string().min(1),
      start: z.string().optional(),
      end: z.string().optional(),
      granularity: z.string().optional(),
      timezone: z.string().optional(),
      goalNames: z.string().optional(), // comma-joined; Tinybird Array() param
    }),
    data: z.object({
      groupByField: z.string(),
      goal: z.string(),
      count: z.coerce.number().int().nonnegative(),
    }),
  });

  const response = await pipe({
    workspaceId,
    start: formatUTCDateTimeClickhouse(startDate),
    end: formatUTCDateTimeClickhouse(endDate),
    granularity,
    timezone,
    ...(goalNames?.length ? { goalNames: goalNames.join(",") } : {}),
  });

  return response.data; // [{ groupByField, goal, count }]
};
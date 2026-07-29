import * as z from "zod/v4";
import { BOT_CATEGORIES } from "@/lib/analytics/get-bot-analytics";
import { DATE_RANGE_INTERVAL_PRESETS } from "@/lib/analytics/constants";

export const botFilteringQuerySchema = z.object({
  workspaceId: z.string().optional(),
  workspaceSlug: z.string().optional(),
  domain: z.string().optional(),
  category: z.enum(BOT_CATEGORIES).optional(),
  groupBy: z
    .enum(["timeseries", "providers", "top_pages", "categories", "count"])
    .default("count"),
  interval: z.enum(DATE_RANGE_INTERVAL_PRESETS).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  timezone: z.string().default("UTC"),
  granularity: z.enum(["hour", "day", "week"]).optional(),
});

export type BotFilteringQuery = z.infer<typeof botFilteringQuerySchema>;
import * as z from "zod/v4";
import {
  BOT_CATEGORIES,
  BOT_GROUP_BYS,
  BOT_VERIFICATION_STATES,
} from "@/lib/analytics/get-bot-analytics";
import { DATE_RANGE_INTERVAL_PRESETS } from "@/lib/analytics/constants";

export const botFilteringQuerySchema = z.object({
  workspaceId: z.string().optional(),
  workspaceSlug: z.string().optional(),
  domain: z.string().optional(),
  category: z.enum(BOT_CATEGORIES).optional(),
  verification: z.enum(BOT_VERIFICATION_STATES).optional(),
  // "true" = events sent with a valid bot token only, "false" = public-token events only.
  authenticated: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  vendor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  groupBy: z.enum(BOT_GROUP_BYS).default("count"),
  interval: z.enum(DATE_RANGE_INTERVAL_PRESETS).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  timezone: z.string().default("UTC"),
  granularity: z.enum(["hour", "day", "week"]).optional(),
});

export type BotFilteringQuery = z.infer<typeof botFilteringQuerySchema>;
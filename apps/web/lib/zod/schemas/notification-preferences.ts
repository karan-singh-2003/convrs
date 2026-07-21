import * as z from "zod/v4";

export const notificationPreferencesSchema = z.object({
  weeklySummary: z.boolean(),
  trafficSpikes: z.boolean(),
  lastWeeklySentAt: z.date().nullable(),
  lastSpikeSentAt: z.date().nullable(),
});

export const updateNotificationPreferencesSchema = z.object({
  weeklySummary: z.boolean().optional(),
  trafficSpikes: z.boolean().optional(),
}).refine((data) => data.weeklySummary !== undefined || data.trafficSpikes !== undefined, {
  message: "At least one preference must be provided",
});
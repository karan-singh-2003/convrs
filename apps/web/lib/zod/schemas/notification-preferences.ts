import * as z from "zod/v4";

export const notificationPreferencesSchema = z.object({
  weeklySummary: z.boolean(),
  trafficSpikes: z.boolean(),
  trafficSpikeThreshold: z.number().int().min(1).max(1_000_000),
  lastWeeklySentAt: z.date().nullable(),
  lastSpikeSentAt: z.date().nullable(),
});

export const updateNotificationPreferencesSchema = z
  .object({
    weeklySummary: z.boolean().optional(),
    trafficSpikes: z.boolean().optional(),
    trafficSpikeThreshold: z.number().int().min(1).max(1_000_000).optional(),
  })
  .refine(
    (data) =>
      data.weeklySummary !== undefined ||
      data.trafficSpikes !== undefined ||
      data.trafficSpikeThreshold !== undefined,
    {
      message: "At least one preference must be provided",
    }
  );

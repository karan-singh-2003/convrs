// lib/zod/schemas/kpi.ts
import * as z from "zod/v4";

export const updateKpiSchema = z
  .object({
    kpiType: z.enum(["revenue", "goal"]),
    kpiEventName: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.kpiType === "revenue" || !!v.kpiEventName, {
    message: "kpiEventName is required when kpiType is 'goal'",
    path: ["kpiEventName"],
  });
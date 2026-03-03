import { WEBHOOK_TRIGGERS } from "@/lib/webhook/constant";
import * as z from "zod";

export const webhookPayloadSchema = z.object({
  id: z.string(),
  event: z.enum(WEBHOOK_TRIGGERS),
  createdAt: z.string(),
  data: z.any(),
});

import { z } from "zod";

export const alertSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().min(1).max(120),
  trigger: z.string().max(120).optional().nullable(),
  subject: z.string().min(1).max(255),
  content: z.string().min(1).max(5000),
  enabled: z.boolean().default(true),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createAlertSchema = z.object({
  name: z.string().min(1).max(120),
  trigger: z.string().max(120).optional().nullable(),
  subject: z.string().min(1).max(255),
  content: z.string().min(1).max(5000),
  enabled: z.boolean().optional(),
});

export const updateAlertSchema = createAlertSchema.partial();

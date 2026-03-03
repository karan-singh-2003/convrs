import { z } from "zod";
import { SCOPES } from "@/lib/api/tokens/scopes";

export const tokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  partialKey: z.string(),
  scopes: z
    .string()
    .nullable()
    .transform((val) => val?.split(" ") ?? []),
  lastUsed: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    image: z.string().nullable(),
    // isMachine: z.boolean(),
  }),
});

export const createTokenSchema = z.object({
  name: z.string({ error: "Name is required" }).min(1).max(50),
  scopes: z.array(z.enum(SCOPES)).default([]).optional(),
});
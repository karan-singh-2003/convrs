import { z } from "zod";

export const TIER_KEYS = [
  "t10k",
  "t100k",
  "t200k",
  "t500k",
  "t1m",
  "t2m",
  "t5m",
  "t10m",
  "t10m_plus",
] as const;

export const tierSchema = z.enum(TIER_KEYS);
export const familySchema = z.enum(["standard", "growth"]);
export const intervalSchema = z.enum(["monthly", "yearly"]);

export const createSubscriptionSchema = z.object({
  intent: familySchema,
  tier: tierSchema,
  interval: intervalSchema,
  targetWorkspaceId: z.string().optional(),
  consolidateStandardSubIds: z.array(z.string()).optional(),
  onboarding: z.boolean().optional(),
});

export const changePlanSchema = z.object({
  targetFamily: familySchema,
  targetTier: tierSchema,
  targetInterval: intervalSchema,
  keepWorkspaceId: z.string().optional(),
  acknowledgeDetachWorkspaceIds: z.array(z.string()).optional(),
});

export const cancelSubscriptionSchema = z.object({
  mode: z.enum(["at_period_end", "immediately"]).default("at_period_end"),
  acknowledgeWorkspaceIds: z.array(z.string()).optional(),
});

export const attachWorkspaceSchema = z.object({
  subscriptionId: z.string(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;

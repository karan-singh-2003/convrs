import { z } from "zod";
import { RESERVED_SLUGS, DEFAULT_REDIRECTS, validSlugRegex } from "@repo/utils";
import slugify from "@sindresorhus/slugify";
import { WorkspaceRole } from "@repo/db/client";

export const roleSchema = z
  .enum(Object.values(WorkspaceRole))
  .describe("The role of the authenticated user in the workspace.");

export const WorkspaceSchema = z
  .object({
    id: z.string().describe("The unique ID of the workspace."),
    name: z.string().describe("The name of the workspace."),
    slug: z.string().describe("The slug of the workspace."),
    domain: z
      .string()
      .nullable()
      .optional()
      .describe("The tracked domain of the workspace."),
    plan: z
      .string()
      .nullable()
      .optional()
      .describe("The current plan of the workspace."),
    planTier: z
      .number()
      .nullable()
      .default(0)
      .describe("The tier of the workspace's plan."),
    stripeId: z
      .string()
      .nullable()
      .optional()
      .describe("The Stripe customer ID of the workspace."),
    stripeCustomerId: z
      .string()
      .nullable()
      .optional()
      .describe("The Stripe customer ID of the workspace."),
    stripeSubscriptionId: z
      .string()
      .nullable()
      .optional()
      .describe("The Stripe subscription ID of the workspace."),
    billingCycleStart: z
      .number()
      .nullable()
      .optional()
      .describe("The day of month the billing cycle starts."),
    billingInterval: z
      .string()
      .nullable()
      .optional()
      .describe("The billing interval of the current subscription."),
    subscriptionStatus: z
      .string()
      .nullable()
      .optional()
      .describe("The current subscription status."),
    freeTrialEndDate: z
      .date()
      .nullable()
      .optional()
      .describe("The date and time when the free trial ends."),
    usage: z.number().optional().describe("Current tracked usage."),
    usageLimit: z.number().optional().describe("Current usage limit."),
    tierEvents: z
      .number()
      .nullable()
      .optional()
      .describe("Plan event limit for the workspace tier."),
    paymentFailedAt: z
      .date()
      .nullable()
      .optional()
      .describe("The date when the last payment failed."),
    ssoEnforcedAt: z
      .date()
      .nullable()
      .describe("The date and time when SSO was enforced for the workspace."),
    logo: z
      .string()
      .nullable()
      .default(null)
      .describe("The logo of the workspace."),
    inviteCode: z
      .string()
      .nullable()
      .describe("The invite code of the workspace."),
    projectToken: z
      .string()
      .nullable()
      .optional()
      .describe("The analytics project token for the workspace."),
      isPublic: z
      .boolean()
      .optional()
      .describe("Whether the workspace is public or not."),
    publicId: z
      .string()
      .nullable()
      .optional()
      .describe("The public ID for the workspace, used for public workspaces."),
    createdAt: z
      .date()
      .describe("The date and time when the workspace was created."),
    users: z
      .array(
        z.object({
          role: roleSchema,
        })
      )
      .describe("The role of the authenticated user in the workspace."),
  })
  .meta({
    title: "Workspace",
  });

const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/;

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(32),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(48, "Slug must be less than 48 characters")
    .transform((v) => slugify(v))
    .refine((v) => validSlugRegex.test(v), { message: "Invalid slug format" })
    .refine(
      async (v) => !(RESERVED_SLUGS.includes(v) || DEFAULT_REDIRECTS[v]),
      {
        message: "Cannot use reserved slugs",
      }
    ),
  domain: z
    .string()
    .min(3, "Domain is required")
    .max(253, "Domain too long")
    .transform((v) =>
      v
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")
    )
    .refine((v) => domainRegex.test(v), {
      message: "Invalid domain format",
    }),
  conversionEnabled: z.boolean().optional(),
});

export const getWorkspaceUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(WorkspaceRole).optional(),
});

export const workspaceUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullish(),
  image: z.string().nullish(),
  role: z.enum(WorkspaceRole),
  isMachine: z.boolean().default(false),
  createdAt: z.date(),
});

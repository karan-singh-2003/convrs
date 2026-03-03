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
  logo: z
    .string()
    .transform((v) => v || null)
    .nullish(),
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

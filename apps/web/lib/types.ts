import { Workspace, WorkspaceRole } from "@repo/db/client";
import { DirectorySyncProviders } from "@boxyhq/saml-jackson";
import { keyof, z } from "zod";
import { workspaceUserSchema } from "@/lib/zod/schemas/workspaces";
import { tokenSchema } from "./zod/schemas/token";
import {
  createWebhookSchema,
  webhookSchema,
  webhookEventSchemaTB,
} from "./zod/schemas/webhook";
import { WEBHOOK_TRIGGERS } from "./webhook/constant";
export interface UserProps {
  id: string;
  name: string;
  email: string;
  image?: string;
  createdAt: Date;
  defaultWorkspace?: string;
  hasPassword?: boolean;
  provider: string | null;
  twoFactorConfirmedAt?: Date | null;
}

export const ONBOARDING_STEPS = [
  "workspace",
  "billing",
  "invite",
  "success",
  "completed",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface WorkspaceProps extends Workspace {
  users: {
    role: WorkspaceRole;
  }[];
}
export type WorkspaceUserProps = z.infer<typeof workspaceUserSchema>;

export interface SAMLProviderProps {
  name: string;
  logo: string;
  saml: "okta" | "azure" | "google";
  samlModalCopy: string;
  scim: keyof typeof DirectorySyncProviders;
  scimModalCopy: {
    url: string;
    token: string;
  };
}

export type StripeMode = "test" | "sandbox" | "live";

export type TokenProps = z.infer<typeof tokenSchema>;

export type WebhookProps = z.infer<typeof webhookSchema>;

export type CreateNewWebhookProps = z.infer<typeof createWebhookSchema>;

export type WebhookTrigger = (typeof WEBHOOK_TRIGGERS)[number];

export type WebhookEventProps = z.infer<typeof webhookEventSchemaTB>;

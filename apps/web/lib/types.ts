import { Workspace, WorkspaceRole, WorkspacePlan } from "@repo/db/client";
import { DirectorySyncProviders } from "@boxyhq/saml-jackson";
import { keyof, z } from "zod";
import { workspaceUserSchema } from "@/lib/zod/schemas/workspaces";
import { tokenSchema } from "./zod/schemas/token";
import { alertSchema } from "./zod/schemas/alert";
import {
  createWebhookSchema,
  webhookSchema,
  webhookEventSchemaTB,
} from "./zod/schemas/webhook";
import { WEBHOOK_TRIGGERS } from "./webhook/constant";
import { InvoiceSchema } from "./zod/schemas/invoices";

export interface UserProps {
  id: string;
  name: string;
  email: string;
  image?: string;
  createdAt: Date;
  defaultWorkspaceId?: string;
  hasPassword?: boolean;
  provider: string | null;
  twoFactorConfirmedAt?: Date | null;
}

export const ONBOARDING_STEPS = [
  "workspace",
  "script",
  "completed",
  "invite ",
  "billing",
  "source",
  "members",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface WorkspaceProps extends Workspace {
  plan: WorkspacePlan;
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

export type AlertProps = z.infer<typeof alertSchema>;

export type WebhookProps = z.infer<typeof webhookSchema>;

export type CreateNewWebhookProps = z.infer<typeof createWebhookSchema>;

export type WebhookTrigger = (typeof WEBHOOK_TRIGGERS)[number];

export type WebhookEventProps = z.infer<typeof webhookEventSchemaTB>;

export type InvoiceProps = z.infer<typeof InvoiceSchema>;

export type FunnelStepType = "goal" | "page_view";

export interface FunnelStepProps {
  id: string;
  name: string;
  value: string;
  type: FunnelStepType;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FunnelProps {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  steps: FunnelStepProps[];
}

import { Workspace, WorkspaceRole } from "@repo/db/client";
import { DirectorySyncProviders } from "@boxyhq/saml-jackson";
export interface UserProps {
  id: string;
  name: string;
  email: string;
  image?: string;
  createdAt: Date;
  defaultWorkspace?: string;
  hasPassword: boolean;
  provider: string | null;
}

export const ONBOARDING_STEPS = [
  "workspace",
  "plan",
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

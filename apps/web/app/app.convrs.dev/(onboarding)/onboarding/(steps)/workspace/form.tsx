"use client";

import { CreateWorkspaceForm } from "@/ui/workspaces/create-workspace-form";
import { useOnboardingProgress } from "../../use-onboarding-progress";

export function Form() {
  const { continueTo } = useOnboardingProgress();
  return (
    <CreateWorkspaceForm
      withTimezone
      onSuccess={({ slug, domain, projectToken }) => {
        const params = {
          ...(domain ? { domain } : {}),
          ...(projectToken ? { projectToken } : {}),
        };
        // The billing step no longer exists in onboarding — trial activation
        // now happens automatically, server-side, on workspace creation
        // (see POST /api/workspaces + lib/billing/auto-trial.ts). Always
        // continue straight to Script.
        continueTo("script", { slug, params });
      }}
    />
  );
}

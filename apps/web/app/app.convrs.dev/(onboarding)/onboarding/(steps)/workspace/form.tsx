"use client";

import { CreateWorkspaceForm } from "@/ui/workspaces/create-workspace-form";
import { useOnboardingProgress } from "../../use-onboarding-progress";
import { BILLING_V2 } from "@/lib/billing/flags";

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
        // Deploy 3b: under BILLING_V2 the workspace is created uncovered, so the
        // onboarding flow stops at the billing step to pick a plan / trial.
        // Flag off keeps the old flow (auto-trial on create → straight to Script).
        if (BILLING_V2) {
          continueTo("billing", { slug, params });
        } else {
          continueTo("script", { slug, params });
        }
      }}
    />
  );
}

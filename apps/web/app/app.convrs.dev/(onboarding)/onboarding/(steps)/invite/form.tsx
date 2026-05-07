"use client";
import { InviteTeammatesForm } from "@/ui/workspaces/invite-teammates-form";
import { useOnboardingProgress } from "../../use-onboarding-progress";
export function Form() {
  const { continueTo } = useOnboardingProgress();
  return (
    <div className="w-full">
      <InviteTeammatesForm onSuccess={() => continueTo("source")} />
    </div>
  );
}

'use client'
import { InviteTeammatesForm } from "@/ui/workspaces/invite-teammates-form";
import { useOnboardingProgress } from "../../use-onboarding-progress";
export function Form() {
  const { finish } = useOnboardingProgress();
  return <InviteTeammatesForm onSuccess={finish}></InviteTeammatesForm>;
}

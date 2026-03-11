import { useAction } from "next-safe-action/hooks";
import { useCallback } from "react";
import type { OnboardingStep } from "@/lib/types";
import { toast } from "sonner";
import { setOnboardingProgressAction } from "@/lib/actions/set-onboarding-progress";
import { useRouter, useSearchParams } from "next/navigation";

const PRE_WORKSPACE_STEPS = ["workspace"];

export const useOnboardingProgress = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("workspace");

  const { execute, isPending, executeAsync, hasSucceeded } = useAction(
    setOnboardingProgressAction,
    {
      onSuccess: () => {},
      onError: (error) => {
        toast.error("Failed to update onboarding progress");
        console.error("Error updating onboarding progress:", error);
      },
    }
  );

  const continueTo = useCallback(
    async (
      step: OnboardingStep,
      {
        slug: providedSlug,
        params,
      }: {
        slug?: string;
        params?: Record<string, string>;
      } = {}
    ) => {
      execute({ onboardingStep: step });
      const queryParams = new URLSearchParams({
        ...(PRE_WORKSPACE_STEPS.includes(step)
          ? {}
          : { workspace: (providedSlug || slug)! }),
      });
      router.push(`/onboarding/${step}?${queryParams}`);
    },
    [router, execute, slug]
  );

  const finish = useCallback(async () => {
    await executeAsync({ onboardingStep: "completed" });
    router.push(slug ? `/${slug}?onboarded=true` : `/`);
  }, [executeAsync, router, slug]);

  return {
    continueTo,
    finish,
    isLoading: isPending,
    isSuccessful: hasSucceeded,
  };
};

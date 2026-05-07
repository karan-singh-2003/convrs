"use client";

import { OnboardingStep } from "@/lib/types";
import { useOnboardingProgress } from "./use-onboarding-progress";

export function SkipButton({ step }: { step?: OnboardingStep }) {
  const { continueTo, finish, isLoading, isSuccessful } =
    useOnboardingProgress();

  return (
    <button
      type="button"
      disabled={isLoading || isSuccessful}
      onClick={() => (step ? continueTo(step) : finish())}
      className="text-sm font-display text-neutral-400 hover:text-neutral-600 transition disabled:opacity-50"
    >
      Skip
    </button>
  );
}

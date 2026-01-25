"use client";

import { OnboardingStep } from "@/lib/types";
import { Button } from "@repo/ui/button";
import { useOnboardingProgress } from "./use-onboarding-progress";
import React from "react";

export function LaterButton({ step }: { step: OnboardingStep }) {
  const { continueTo, isLoading, isSuccessful ,finish} = useOnboardingProgress();

  return (
    <Button
      variant="secondary"
      text="I'll do this later"
      onClick={() => (step === "completed" ? finish() : continueTo(step))}
      loading={isLoading || isSuccessful}
    ></Button>
  );
}

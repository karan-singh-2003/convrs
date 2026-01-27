"use client";
import { OnboardingStep } from "@/lib/types";
import { Button, ButtonProps } from "@repo/ui";
import React from "react";
import { useOnboardingProgress } from "./use-onboarding-progress";

const NextButton = ({ step , ...rest}: { step: OnboardingStep }&ButtonProps) => {
  const { continueTo, isLoading, isSuccessful } = useOnboardingProgress();
  return (
    <Button
      variant="primary"
      text="Next"
      onClick={() => continueTo(step)}
      loading={isLoading || isSuccessful}
      {...rest}
    ></Button>
  );
};

export default NextButton;

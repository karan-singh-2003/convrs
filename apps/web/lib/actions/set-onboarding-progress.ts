'use server'

import z from "zod";
import { authUserActionClient } from "./safe-action";
import { ONBOARDING_STEPS } from "../types";
import { onboardingStepCache } from "../api/workspaces/onboarding-step-cache";
const schema = z.object({
  onboardingStep: z.enum(ONBOARDING_STEPS).nullable(),
});

export const setOnboardingProgressAction = authUserActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx }) => {
    const { onboardingStep } = parsedInput;

    try {
      if (onboardingStep) {
        await onboardingStepCache.set({
          userId: ctx.user.id,
          step: onboardingStep,
        });
      }
    } catch (error) {
      console.error("Error updating onboarding progress:", error);
      throw new Error("Failed to update onboarding progress.");
    }

    return { success: true };
  });

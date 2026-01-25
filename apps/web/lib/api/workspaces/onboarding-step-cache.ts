import { OnboardingStep } from "@/lib/types";
import { redis } from "@/lib/upstash";

const CACHE_KEY_PREFIX = "onboarding-step";
export const ONBOARDING_WINDOW_SECONDS = 24 * 60 * 60; // 1 day

class OnboardingStepCache {
  async set({ userId, step }: { userId: string; step: OnboardingStep }) {
    (await redis.set(`${CACHE_KEY_PREFIX}:${userId}`, step),
      {
        ex: ONBOARDING_WINDOW_SECONDS,
      });
  }

  async get({ userId }: { userId: string }): Promise<OnboardingStep | null> {
    return (await redis.get(
      `${CACHE_KEY_PREFIX}:${userId}`
    )) as OnboardingStep | null;
  }
}

export const onboardingStepCache = new OnboardingStepCache();

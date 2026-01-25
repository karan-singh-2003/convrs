import { Redis } from "@upstash/redis";
import { OnboardingStep } from "@/lib/types";

const CACHE_KEY_PREFIX = "onboarding-step";
export const ONBOARDING_WINDOW_SECONDS = 24 * 60 * 60; // 1 day

// Direct Redis instantiation for edge runtime
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

class OnboardingStepCacheEdge {
  async set({ userId, step }: { userId: string; step: OnboardingStep }) {
    await redis.set(`${CACHE_KEY_PREFIX}:${userId}`, step, {
      ex: ONBOARDING_WINDOW_SECONDS,
    });
  }

  async get({ userId }: { userId: string }): Promise<OnboardingStep | null> {
    return (await redis.get(
      `${CACHE_KEY_PREFIX}:${userId}`
    )) as OnboardingStep | null;
  }
}

export const onboardingStepCacheEdge = new OnboardingStepCacheEdge();

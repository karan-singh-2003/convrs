import { OnboardingStep } from "../types";
import { redis } from "../upstash";

const CACHE_KEY_PREFIX = "onboarding-step";
export const ONBOARDING_WINDOW_MS = 24 * 60 * 60 * 1000;
class OnboardingStepCache {
  async set({ userId, step }: { userId: string; step: OnboardingStep }) {
    return await redis.set(`${CACHE_KEY_PREFIX}:${userId}`, step, {
      ex: 60 * 60 * 24, // 24 hours
    });
  }

  async get({ userId }: { userId: string }) {
    return await redis.get(`${CACHE_KEY_PREFIX}:${userId}`);
  }
}
export const onboardingStepCache = new OnboardingStepCache();
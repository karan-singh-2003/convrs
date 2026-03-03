import { OnboardingStep } from "../types";
import { redis } from "../upstash";

const CACHE_KEY_PREFIX = "onboarding-step";
export const ONBOARDING_WINDOW_SECONDS = 24 * 60 * 60 ;
class OnboardingStepCache {
  async set({ userId, step }: { userId: string; step: OnboardingStep }) {
    return await redis.set(`${CACHE_KEY_PREFIX}:${userId}`, step, {
      ex: ONBOARDING_WINDOW_SECONDS, // 24 hours
    });
  }

  async get({ userId }: { userId: string }) {
    return await redis.get(`${CACHE_KEY_PREFIX}:${userId}`);
  }


  async mset({userIds, step}: {userIds: string[]; step: OnboardingStep}) {
    const pipeline = redis.pipeline();
    userIds.forEach(userId => {
      pipeline.set(`${CACHE_KEY_PREFIX}:${userId}`, step, {
        ex: ONBOARDING_WINDOW_SECONDS, // 24 hours
      });
    });
    return await pipeline.exec();
  }
}
export const onboardingStepCache = new OnboardingStepCache();
// packages/analytics/src/utils/tracked-event-registry.ts
import { redis } from "../lib/redis"; // swap for your actual client
import { prisma } from "@repo/db";
import { TrackedEventType, TrackedEventTrigger } from "@repo/db/client";

const REDIS_TTL_SECONDS = 60 * 60 * 24; // 24h

// Runtime guards — Tinybird/recordEvent hands us plain strings, so we validate
// against the actual enum values rather than trusting the caller's string.
function isTrackedEventType(value: string): value is TrackedEventType {
  return Object.values(TrackedEventType).includes(value as TrackedEventType);
}

function isTrackedEventTrigger(value: string): value is TrackedEventTrigger {
  return Object.values(TrackedEventTrigger).includes(
    value as TrackedEventTrigger
  );
}

export async function registerTrackedEvent({
  workspaceId,
  eventName,
  eventType,
  trigger,
}: {
  workspaceId: string;
  eventName: string;
  eventType: string;
  trigger?: string | null;
}) {
  // Guard first — an event_type we don't recognize (e.g. a new type added to
  // recordEvent's normalization but not yet added to the Prisma enum) should
  // be logged and skipped, not thrown from inside a fire-and-forget call.
  if (!isTrackedEventType(eventType)) {
    console.error("[TrackedEvent] Unknown eventType, skipping", {
      workspaceId,
      eventName,
      eventType,
    });
    return;
  }

  const validatedTrigger: TrackedEventTrigger | null =
    trigger && isTrackedEventTrigger(trigger) ? trigger : null;

  if (trigger && !validatedTrigger) {
    console.error("[TrackedEvent] Unknown trigger, storing as null", {
      workspaceId,
      eventName,
      trigger,
    });
  }

  const cacheKey = `tracked-event:${workspaceId}:${eventType}:${eventName}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return; // seen within last 24h, nothing to do
  } catch (error) {
    console.error("[TrackedEvent] Redis read failed", { cacheKey, error });
  }

  try {
    await prisma.trackedEvent.upsert({
      where: {
        workspaceId_eventName_eventType: { workspaceId, eventName, eventType },
      },
      create: { workspaceId, eventName, eventType, trigger: validatedTrigger },
      update: { lastSeenAt: new Date() },
    });
  } catch (error) {
    console.error("[TrackedEvent] Postgres upsert failed", { cacheKey, error });
    return;
  }

  redis.set(cacheKey, "1", { ex: REDIS_TTL_SECONDS }).catch((error) => {
    console.error("[TrackedEvent] Redis write failed", { cacheKey, error });
  });
}
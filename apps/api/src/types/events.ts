/**
 * types/events.ts
 *
 * Zod schemas are the single source of truth.
 * TypeScript types are derived from them so validation and types stay in sync.
 */

import { z } from "zod";

// ── Individual event schema ───────────────────────────────────────────────────

export const EventTypeSchema = z.enum([
  "pageview",
  "event",
  "identify",
  "custom",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const RawEventSchema = z.object({
  /** Discriminates how the event is processed. */
  type: EventTypeSchema,

  /** Current page URL — required for all event types. */
  url: z.string().url().max(2_048),

  /** ISO 8601 timestamp string. */
  timestamp: z.string().datetime(),

  // Page metadata — optional for most event types
  title: z.string().max(512).optional(),
  hostname: z.string().max(253).optional(),
  referrer: z.string().max(2_048).nullable().optional(),
  language: z.string().max(35).optional(), // BCP-47, e.g. "en-US"
  timezone: z.string().max(50).optional(), // e.g. "Asia/Calcutta"

  // Screen dimensions — optional
  screen_w: z.number().int().positive().optional(),
  screen_h: z.number().int().positive().optional(),
  viewport_w: z.number().int().positive().optional(),
  viewport_h: z.number().int().positive().optional(),

  /** For event type "event" — custom event name and properties. */
  event_name: z.string().max(128).optional(),
  props: z.record(z.string(), z.string()).optional(),

  /** For event type "identify" — user traits. */
  traits: z.record(z.string(), z.string()).optional(),
});
export type RawEvent = z.infer<typeof RawEventSchema>;

// ── Batch request body ────────────────────────────────────────────────────────

export const TrackRequestSchema = RawEventSchema.extend({
  website_id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[\w-]+$/, "website_id may only contain word chars and hyphens"),

  visitor_id: z.string().min(1).max(128),

  session_id: z.string().min(1).max(128),
});
export type TrackRequest = z.infer<typeof TrackRequestSchema>;

// ── Normalised event shape written to ClickHouse ─────────────────────────────

export interface NormalisedEvent {
  workspace_id: string;
  session_id: string;
  visitor_id: string;
  event_type: string;
  url: string;
  referrer: string | null;
  hostname: string | null;
  page_title: string | null;
  language: string | null;
  timezone: string | null;
  screen_w: number | null;
  screen_h: number | null;
  viewport_w: number | null;
  viewport_h: number | null;
  event_name: string | null;
  props: Record<string, string>;
  traits: Record<string, string> | null;
  ip_hash: string; // SHA-256 of the client IP — always present
  user_agent: string | null;
  // Server-side enrichment
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  timestamp: number; // Unix milliseconds epoch — ClickHouse DateTime64(3)
}

// ── API response shapes ───────────────────────────────────────────────────────

export interface TrackResponse {
  ok: true;
  accepted: number; // number of events queued
}

export interface ErrorResponse {
  ok: false;
  error: string;
  details?: unknown;
}

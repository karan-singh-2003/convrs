/**
 * routes/track.ts
 *
 * POST /track
 *
 * Accepts a flat analytics event from the tracker script,
 * validates it with Zod, and hands it off to the ingest pipeline.
 *
 * Request body shape (flat, single event):
 *   - Required: website_id, visitor_id, session_id, type, url, timestamp
 *   - Optional: title, hostname, referrer, language, timezone, screen_w, screen_h, viewport_w, viewport_h
 *   - Conditional: event_name & props (for type "event"), traits (for type "identify")
 *
 * Response codes:
 *   202 Accepted  – event queued (not yet written to ClickHouse)
 *   400 Bad Request – validation failure
 *   429 Too Many Requests – rate limit exceeded (handled by @fastify/rate-limit)
 *   500 Internal Server Error – unexpected failure
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import { TrackRequestSchema } from "../types/events.js";
import { ingestEvents } from "../services/eventService.js";
import { recordEvent } from "../lib/tinybird/record-event.js";
import type {
  TrackResponse,
  ErrorResponse,
  RawEvent,
} from "../types/events.js";

// Fastify JSON-schema for fast serialisation of the success response
const trackResponseSchema = {
  202: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      accepted: { type: "number" },
    },
    required: ["ok", "accepted"],
  },
};

export async function trackRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{
    Body: unknown;
    Reply: TrackResponse | ErrorResponse;
  }>(
    "/track",
    {
      schema: {
        response: trackResponseSchema,
      },
      // Disable Fastify's own body validation — Zod handles it
      attachValidation: true,
    },
    async (request, reply: FastifyReply) => {
      // ── 1. Validate with Zod ────────────────────────────────────────────
      const parseResult = TrackRequestSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          ok: false,
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        } satisfies ErrorResponse);
      }

      const { website_id, visitor_id, session_id, ...eventData } =
        parseResult.data;

      // ── 2. Extract client metadata ──────────────────────────────────────
      // Prefer X-Forwarded-For set by a trusted reverse proxy (nginx, Caddy …).
      // request.ip is always a string in Fastify — it is never null.
      const clientIp =
        (request.headers["x-forwarded-for"] as string | undefined)
          ?.split(",")[0]
          ?.trim() ?? request.ip;

      const userAgent = request.headers["user-agent"] as string;

      // ── 3. Run ingestion pipeline ───────────────────────────────────────
      // Wrap the flat event in an array for backward compatibility with ingestEvents
      const accepted = await ingestEvents(
        website_id,
        visitor_id,
        session_id,
        [eventData] as unknown as RawEvent[],
        clientIp,
        userAgent,
        request.log
      );

      request.log.info(
        { website_id, accepted, ip: clientIp },
        "Event accepted."
      );

      // ── 4. Record to Tinybird (async, non-blocking) ──────────────────────
      // Fire and forget — don't wait for Tinybird response
      void recordEvent({
        timestamp: new Date().toISOString(),
        event_name: eventData.type || "unknown",
        workspace_id: website_id,
        user_id: visitor_id,
        session_id: session_id,
        ip: clientIp,
        ua: userAgent,
        url: eventData.url || "",
        referer: eventData.referrer || "(direct)",
        properties: eventData.props || {},
      }).catch((err) => {
        request.log.debug(
          { err, website_id },
          "Tinybird recording failed (non-blocking)"
        );
      });

      return reply.status(202).send({ ok: true, accepted });
    }
  );

  // ── Health probe ──────────────────────────────────────────────────────────
  fastify.get("/health", async (_req, reply) => {
    return reply.status(200).send({ ok: true, ts: Date.now() });
  });
}

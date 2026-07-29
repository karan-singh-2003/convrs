// packages/analytics/src/track-bot-event.ts
import { fetchWithRetry } from "@repo/utils";
import type { FastifyBaseLogger } from "fastify";

/**
 * Row shape for the `bot_traffic_events` Tinybird datasource. Classification
 * (vendor/category), filtering (hostname/page/ip/country blocks), and auth
 * are all handled upstream by the ingest controller — this function's only
 * job is shaping + sending the already-decided event to Tinybird, mirroring
 * how recordEvent() sends click events.
 */
export interface BotTrafficEvent {
  event_id: string;
  timestamp: string; // "YYYY-MM-DD HH:MM:SS" (Clickhouse DateTime64 format)
  workspace_id: string;
  domain: string;
  url: string;
  hostname: string;
  page: string;
  vendor: string;
  agent_name: string;
  category: string;
  user_agent: string;
  ip: string | null;
  country: string;
  status_code: number | null;
  referrer: string | null;
  source: string;
}

export async function trackBotEvent({
  event,
  logger,
}: {
  event: BotTrafficEvent;
  logger: FastifyBaseLogger;
}): Promise<BotTrafficEvent | null> {
  // ── Guard: the essentials must be present ──────────────────────────────
  if (!event.workspace_id || !event.vendor || !event.category) {
    logger.warn(
      "[trackBotEvent] Missing workspace_id, vendor, or category — skipping"
    );
    return null;
  }

  logger.info(
    {
      event_id: event.event_id,
      workspace_id: event.workspace_id,
      vendor: event.vendor,
      category: event.category,
    },
    "[trackBotEvent] Sending to Tinybird"
  );

  // ── Fire to Tinybird (non-blocking) ───────────────────────────────────────
  (async () => {
    try {
      const apiUrl = process.env.TINYBIRDS_API_URL;
      const apiKey = process.env.TINYBIRDS_API_KEY;

      if (!apiUrl || !apiKey) {
        logger.error(
          { apiUrl, apiKey },
          "[trackBotEvent] Missing Tinybird credentials"
        );
        return;
      }

      const response = await fetchWithRetry(
        `${apiUrl}/v0/events?name=bot_traffic_events&wait=true`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok || (responseBody as any).error) {
        logger.error(
          { status: response.status, body: responseBody },
          "[trackBotEvent] Tinybird error"
        );
      } else {
        logger.info(
          { status: response.status, body: responseBody },
          "[trackBotEvent] Tinybird success"
        );
      }
    } catch (error) {
      logger.error({ error }, "[trackBotEvent] Failed");
    }
  })().catch((error) => {
    logger.error({ error }, "[trackBotEvent] Unhandled error");
  });

  return event;
}
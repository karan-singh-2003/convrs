/**
 * lib/enrich.ts
 *
 * Server-side enrichment: derives browser / OS / device from the User-Agent
 * and country / region / city from the client IP via an in-memory geo DB.
 *
 * Both operations are synchronous — no network I/O, no added latency on
 * the hot ingestion path.
 *
 * PRIVACY: The raw IP is used only inside enrichRequest() for the geo lookup.
 * It is never returned, logged, or stored.  Only ip_hash (SHA-256) lands in
 * ClickHouse.
 */

import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Enrichment {
  /** Browser name, e.g. "Chrome", "Safari", "Firefox" */
  browser: string | null;
  /** OS name, e.g. "Windows", "iOS", "Android" */
  os: string | null;
  /** Device category: "desktop" | "mobile" | "tablet" | "smarttv" | … */
  device: string | null;
  /** ISO 3166-1 alpha-2 country code, e.g. "US", "DE" */
  country: string | null;
  /** ISO 3166-2 subdivision code, e.g. "CA", "NY" */
  region: string | null;
  /** City name, e.g. "San Francisco" */
  city: string | null;
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Derive enrichment fields from a single request's IP and User-Agent.
 *
 * Called once per batch in ingestEvents() — all events in a batch share the
 * same client IP and User-Agent so there's no need to repeat the work per
 * event.
 */
export function enrichRequest(
  ip: string,
  userAgent: string | null
): Enrichment {
  // ── UA parsing ────────────────────────────────────────────────────────────
  let browser: string | null = null;
  let os: string | null = null;
  let device: string | null = null;

  if (userAgent) {
    const result = new UAParser(userAgent).getResult();
    browser = result.browser.name ?? null;
    os = result.os.name ?? null;
    // ua-parser-js returns undefined device.type for desktops; normalise.
    device = result.device.type ?? "desktop";
  }

  // ── Geo lookup ────────────────────────────────────────────────────────────
  // geoip.lookup() is synchronous and reads from the in-process MaxMind DB —
  // no external calls, O(log n) lookup time.
  let country: string | null = null;
  let region: string | null = null;
  let city: string | null = null;

  const geo = geoip.lookup(ip);
  if (geo) {
    // geoip-lite returns empty strings for unknown subdivisions; coerce to null
    country = geo.country || null;
    region = geo.region || null;
    city = geo.city || null;
  }

  return { browser, os, device, country, region, city };
}

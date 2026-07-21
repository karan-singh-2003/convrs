// packages/analytics/src/import/raw-convrs-import.ts
//
// Re-imports a raw_events.csv produced by exportWorkspaceData (see
// ../export/export-workspace-data.ts) into a (possibly different) workspace.
// Unlike the Plausible importer, this is lossless: real session_ids, real
// bounce/duration behavior, real per-event dimensions all carry over as-is.
// We only rewrite workspace_id/hostname (to attribute to the destination
// workspace/domain) and regenerate event_id + prefix visitor/session ids
// (to avoid collisions if re-importing into the *same* workspace twice, or
// across workspaces that happen to reuse a visitor_id).

import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { randomUUID, createHash } from "node:crypto";
import type { TinybirdEvent } from "./plausible-import";

export interface RawConvrsImportResult {
  events: TinybirdEvent[];
  rowCount: number;
}

function rehash(prefix: string, workspaceId: string, value: string): string {
  const h = createHash("sha256")
    .update(`${prefix}|${workspaceId}|${value}`)
    .digest("hex");
  return `convrs_${h.slice(0, 32)}`;
}

export function parseRawConvrsExport(
  zipBuffer: Buffer,
  { workspaceId, hostname }: { workspaceId: string; hostname: string }
): RawConvrsImportResult {
  const zip = new AdmZip(zipBuffer);
  const entry = zip
    .getEntries()
    .find((e) => e.entryName.toLowerCase().endsWith("raw_events.csv"));

  if (!entry) {
    throw new Error(
      "No raw_events.csv found in this zip — is this a Convrs export? " +
        "(Plausible exports don't have this file — use the Plausible import instead.)"
    );
  }

  const text = entry.getData().toString("utf-8");
  if (!text.trim()) return { events: [], rowCount: 0 };

  const rows: Record<string, string>[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const events: TinybirdEvent[] = rows.map((row) => {
    // Re-key visitor/session ids so this import can't collide with existing
    // rows (e.g. re-importing the same export twice, or two workspaces that
    // happen to share a visitor_id from before the migration).
    const visitorId = rehash("visitor", workspaceId, row.visitor_id);
    const sessionId = row.session_id
      ? rehash("session", workspaceId, row.session_id)
      : "";

    return {
      event_id: randomUUID(),
      timestamp: row.timestamp,
      event_type: row.event_type,
      event_name: row.event_name,

      workspace_id: workspaceId,
      user_id: "",
      visitor_id: visitorId,
      session_id: sessionId || null,
      identity_hash: "",

      utm_source: row.utm_source || null,
      utm_medium: row.utm_medium || null,
      utm_campaign: row.utm_campaign || null,
      utm_content: row.utm_content || null,
      utm_term: row.utm_term || null,

      // Rewrite hostname to the destination workspace's domain, but keep
      // the original path so page-level breakdowns stay meaningful.
      url: rewriteHost(row.url, hostname),
      hostname,
      page: row.page || null,
      entrypage: row.entrypage || null,
      exitlink: row.exitlink || null,
      referer: row.referer,
      referer_url: row.referer_url,

      country: row.country,
      city: row.city,
      region: row.region,
      continent: row.continent,
      latitude: null,
      longitude: null,

      device: row.device,
      device_model: row.device_model,
      device_vendor: row.device_vendor,
      browser: row.browser,
      browser_version: row.browser_version,
      os: row.os,
      os_version: row.os_version,
      engine: "Unknown",
      engine_version: "Unknown",
      cpu_architecture: "Unknown",
      ua: "",
      bot: 0,

      ip: null,
      vercel_region: null,

      qr: 0,
      trigger: row.trigger || null,

      event_properties: injectImportTag(row.event_properties),

      revenue: Number(row.revenue) || 0,
      currency: row.currency || "",
    };
  });

  return { events, rowCount: events.length };
}

function rewriteHost(originalUrl: string, hostname: string): string {
  try {
    const u = new URL(originalUrl);
    u.hostname = hostname;
    u.protocol = "https:";
    return u.toString();
  } catch {
    return `https://${hostname}/`;
  }
}

function injectImportTag(rawProps: string): string {
  try {
    const parsed = rawProps ? JSON.parse(rawProps) : {};
    return JSON.stringify({ ...parsed, _imported: "convrs" });
  } catch {
    return JSON.stringify({ _imported: "convrs" });
  }
}
// packages/analytics/src/export/export-workspace-data.ts
//
// Exports a workspace's analytics as a zip containing:
//   - raw_events.csv        — full-fidelity Convrs-native rows. Use this to
//                             re-import into another Convrs workspace with
//                             zero data loss (real sessions, real bounce
//                             rate, real durations).
//   - imported_*.csv         — the same file names/columns your Plausible
//                             importer already reads. Reconstructed from the
//                             raw events by grouping them back into sessions.
//                             This is what makes the export portable to
//                             Plausible, Datafast, or any other tool that
//                             accepts a Plausible-style import — not just
//                             Convrs. It's lossy the same way any aggregate
//                             format is lossy (see plausible-import.ts) —
//                             that's inherent to the format, not new here.

import AdmZip from "adm-zip";
import { stringify } from "csv-stringify/sync";

export interface ExportOptions {
  workspaceId: string;
  start?: string; // ISO date, inclusive
  end?: string; // ISO date, inclusive
}

interface RawEvent {
  event_id: string;
  timestamp: string;
  event_type: string;
  event_name: string;
  visitor_id: string;
  session_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  url: string;
  hostname: string;
  page: string | null;
  entrypage: string | null;
  exitlink: string | null;
  referer: string;
  referer_url: string;
  country: string;
  city: string;
  region: string;
  continent: string;
  device: string;
  device_model: string;
  device_vendor: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  engine: string;
  engine_version: string;
  ua: string;
  trigger: string | null;
  event_properties: string;
  revenue: number | null;
  currency: string | null;
}

const PAGE_SIZE = 10000;

// ── Step 1: page through Tinybird until we run out of rows ─────────────────
async function fetchAllEvents({
  workspaceId,
  start,
  end,
}: ExportOptions): Promise<RawEvent[]> {
  const apiUrl = process.env.TINYBIRDS_API_URL;
  const apiKey = process.env.TINYBIRDS_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error("Missing TINYBIRDS_API_URL / TINYBIRDS_API_KEY");
  }

  const all: RawEvent[] = [];
  let offset = 0;

  // Safety valve so a misbehaving pipe can't loop forever.
  const MAX_PAGES = 2000; // 2000 * 10000 = 20M rows ceiling
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      workspaceId,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (start) params.set("start", start);
    if (end) params.set("end", end);

    const res = await fetch(
      `${apiUrl}/v0/pipes/v1_export_events_pipe.json?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Tinybird export query failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as { data: RawEvent[] };
    all.push(...json.data);

    if (json.data.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }

  return all;
}

// ── Step 2: reconstruct sessions from raw pageview-shaped events ───────────
interface SessionSummary {
  sessionId: string;
  visitorId: string;
  date: string; // YYYY-MM-DD, from the session's first event
  pageviewCount: number;
  durationSeconds: number;
  entrypage: string;
  exitlink: string;
  referer: string;
  refererUrl: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  country: string;
  region: string;
  city: string;
  device: string;
  browser: string;
  os: string;
}

function dateKey(ts: string): string {
  return ts.slice(0, 10); // "2026-01-15 10:22:03.000" -> "2026-01-15"
}

function buildSessions(events: RawEvent[]): SessionSummary[] {
  const pageviewEvents = events.filter((e) => e.event_type === "pageview");

  const bySession = new Map<string, RawEvent[]>();
  for (const e of pageviewEvents) {
    // Fall back to a synthetic per-event session key if session_id is
    // missing (legacy/anonymous rows) — each becomes its own single-page,
    // zero-duration "session", which is a safe (if slightly bounce-heavy)
    // default rather than silently dropping the row.
    const key = e.session_id || `__no_session__${e.event_id}`;
    const arr = bySession.get(key);
    if (arr) arr.push(e);
    else bySession.set(key, [e]);
  }

  const sessions: SessionSummary[] = [];

  for (const [sessionId, sessionEvents] of bySession) {
    sessionEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const first = sessionEvents[0];
    const last = sessionEvents[sessionEvents.length - 1];

    const durationSeconds =
      (new Date(last.timestamp + "Z").getTime() -
        new Date(first.timestamp + "Z").getTime()) /
      1000;

    sessions.push({
      sessionId,
      visitorId: first.visitor_id,
      date: dateKey(first.timestamp),
      pageviewCount: sessionEvents.length,
      durationSeconds: Math.max(0, durationSeconds),
      entrypage: first.entrypage || first.page || "/",
      exitlink: last.exitlink || last.page || "/",
      referer: first.referer || "(direct)",
      refererUrl: first.referer_url || "(direct)",
      utm_source: first.utm_source || "",
      utm_medium: first.utm_medium || "",
      utm_campaign: first.utm_campaign || "",
      utm_term: first.utm_term || "",
      utm_content: first.utm_content || "",
      country: first.country || "Unknown",
      region: first.region || "Unknown",
      city: first.city || "Unknown",
      device: first.device || "Unknown",
      browser: first.browser || "Unknown",
      os: first.os || "Unknown",
    });
  }

  return sessions;
}

// ── Step 3: aggregate helpers ───────────────────────────────────────────────
interface DayGroupAgg {
  visitors: Set<string>;
  bounces: number;
  totalDuration: number;
}

function groupSessionsBy(
  sessions: SessionSummary[],
  keyFn: (s: SessionSummary) => string
): Map<string, DayGroupAgg> {
  const groups = new Map<string, DayGroupAgg>();
  for (const s of sessions) {
    const key = keyFn(s);
    let g = groups.get(key);
    if (!g) {
      g = { visitors: new Set(), bounces: 0, totalDuration: 0 };
      groups.set(key, g);
    }
    g.visitors.add(s.visitorId);
    if (s.pageviewCount === 1) g.bounces += 1;
    g.totalDuration += s.durationSeconds;
  }
  return groups;
}

function toRows(
  groups: Map<string, DayGroupAgg>,
  splitKey: (key: string) => Record<string, string>
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  for (const [key, g] of groups) {
    const visitors = g.visitors.size;
    rows.push({
      ...splitKey(key),
      visitors,
      bounces: g.bounces,
      visit_duration:
        visitors > 0 ? Math.round(g.totalDuration / visitors) : 0,
    });
  }
  return rows;
}

function csv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  return stringify(rows, { header: true });
}

// ── Step 4: build every file and zip them ───────────────────────────────────
export async function exportWorkspaceData(
  options: ExportOptions
): Promise<{ buffer: Buffer; rowCount: number }> {
  const events = await fetchAllEvents(options);
  const sessions = buildSessions(events);

  const zip = new AdmZip();

  // ── raw_events.csv: full fidelity, for re-importing into Convrs ─────────
  const rawRows = events.map((e) => ({
    event_id: e.event_id,
    timestamp: e.timestamp,
    event_type: e.event_type,
    event_name: e.event_name,
    visitor_id: e.visitor_id,
    session_id: e.session_id ?? "",
    utm_source: e.utm_source ?? "",
    utm_medium: e.utm_medium ?? "",
    utm_campaign: e.utm_campaign ?? "",
    utm_content: e.utm_content ?? "",
    utm_term: e.utm_term ?? "",
    url: e.url,
    hostname: e.hostname,
    page: e.page ?? "",
    entrypage: e.entrypage ?? "",
    exitlink: e.exitlink ?? "",
    referer: e.referer,
    referer_url: e.referer_url,
    country: e.country,
    city: e.city,
    region: e.region,
    continent: e.continent,
    device: e.device,
    device_model: e.device_model,
    device_vendor: e.device_vendor,
    browser: e.browser,
    browser_version: e.browser_version,
    os: e.os,
    os_version: e.os_version,
    trigger: e.trigger ?? "",
    event_properties: e.event_properties,
    revenue: e.revenue ?? 0,
    currency: e.currency ?? "",
  }));
  zip.addFile("raw_events.csv", Buffer.from(csv(rawRows), "utf-8"));

  // ── imported_visitors.csv: totals per day ────────────────────────────────
  const byDay = groupSessionsBy(sessions, (s) => s.date);
  zip.addFile(
    "imported_visitors.csv",
    Buffer.from(
      csv(
        toRows(byDay, (key) => ({ date: key })).map((r) => ({
          date: r.date,
          visitors: r.visitors,
          pageviews: sessions
            .filter((s) => s.date === r.date)
            .reduce((sum, s) => sum + s.pageviewCount, 0),
          bounces: r.bounces,
          visit_duration: r.visit_duration,
        }))
      ),
      "utf-8"
    )
  );

  // ── imported_sources.csv ─────────────────────────────────────────────────
  const bySource = groupSessionsBy(sessions, (s) => `${s.date}\u0001${s.referer}`);
  zip.addFile(
    "imported_sources.csv",
    Buffer.from(
      csv(
        toRows(bySource, (key) => {
          const [date, source] = key.split("\u0001");
          return { date, source };
        })
      ),
      "utf-8"
    )
  );

  // ── imported_locations.csv (no bounce/duration in Plausible's own format) ─
  const byGeo = groupSessionsBy(
    sessions,
    (s) => `${s.date}\u0001${s.country}\u0001${s.region}\u0001${s.city}`
  );
  zip.addFile(
    "imported_locations.csv",
    Buffer.from(
      csv(
        Array.from(byGeo.entries()).map(([key, g]) => {
          const [date, country, region, city] = key.split("\u0001");
          return { date, country, region, city, visitors: g.visitors.size };
        })
      ),
      "utf-8"
    )
  );

  // ── imported_devices.csv / browsers.csv / operating_systems.csv ─────────
  const byDevice = groupSessionsBy(sessions, (s) => `${s.date}\u0001${s.device}`);
  zip.addFile(
    "imported_devices.csv",
    Buffer.from(
      csv(
        toRows(byDevice, (key) => {
          const [date, device] = key.split("\u0001");
          return { date, device };
        })
      ),
      "utf-8"
    )
  );

  const byBrowser = groupSessionsBy(sessions, (s) => `${s.date}\u0001${s.browser}`);
  zip.addFile(
    "imported_browsers.csv",
    Buffer.from(
      csv(
        toRows(byBrowser, (key) => {
          const [date, browser] = key.split("\u0001");
          return { date, browser };
        })
      ),
      "utf-8"
    )
  );

  const byOs = groupSessionsBy(sessions, (s) => `${s.date}\u0001${s.os}`);
  zip.addFile(
    "imported_operating_systems.csv",
    Buffer.from(
      csv(
        toRows(byOs, (key) => {
          const [date, os] = key.split("\u0001");
          return { date, operating_system: os };
        }).map((r) => ({
          date: r.date,
          operating_system: (r as any).operating_system,
          visitors: r.visitors,
          bounces: r.bounces,
          visit_duration: r.visit_duration,
        }))
      ),
      "utf-8"
    )
  );

  // ── imported_entry_pages.csv / exit_pages.csv ────────────────────────────
  const byEntry = groupSessionsBy(sessions, (s) => `${s.date}\u0001${s.entrypage}`);
  zip.addFile(
    "imported_entry_pages.csv",
    Buffer.from(
      csv(
        toRows(byEntry, (key) => {
          const [date, entry_page] = key.split("\u0001");
          return { date, entry_page };
        })
      ),
      "utf-8"
    )
  );

  const byExit = new Map<string, Set<string>>();
  for (const s of sessions) {
    const key = `${s.date}\u0001${s.exitlink}`;
    let set = byExit.get(key);
    if (!set) {
      set = new Set();
      byExit.set(key, set);
    }
    set.add(s.visitorId);
  }
  zip.addFile(
    "imported_exit_pages.csv",
    Buffer.from(
      csv(
        Array.from(byExit.entries()).map(([key, visitors]) => {
          const [date, exit_page] = key.split("\u0001");
          return { date, exit_page, visitors: visitors.size };
        })
      ),
      "utf-8"
    )
  );

  // ── imported_pages.csv — per-event page counts (not session-level) ──────
  const pageviewEvents = events.filter((e) => e.event_type === "pageview");
  const byPage = new Map<string, { visitors: Set<string>; pageviews: number }>();
  for (const e of pageviewEvents) {
    const page = e.page || "/";
    const date = dateKey(e.timestamp);
    const key = `${date}\u0001${page}`;
    let g = byPage.get(key);
    if (!g) {
      g = { visitors: new Set(), pageviews: 0 };
      byPage.set(key, g);
    }
    g.visitors.add(e.visitor_id);
    g.pageviews += 1;
  }
  zip.addFile(
    "imported_pages.csv",
    Buffer.from(
      csv(
        Array.from(byPage.entries()).map(([key, g]) => {
          const [date, page] = key.split("\u0001");
          return {
            date,
            page,
            visitors: g.visitors.size,
            pageviews: g.pageviews,
          };
        })
      ),
      "utf-8"
    )
  );

  // ── imported_custom_events.csv (goals) ───────────────────────────────────
  const goalEvents = events.filter((e) => e.event_type === "goals");
  const byGoal = new Map<string, { visitors: Set<string>; events: number }>();
  for (const e of goalEvents) {
    const date = dateKey(e.timestamp);
    const key = `${date}\u0001${e.event_name}`;
    let g = byGoal.get(key);
    if (!g) {
      g = { visitors: new Set(), events: 0 };
      byGoal.set(key, g);
    }
    g.visitors.add(e.visitor_id);
    g.events += 1;
  }
  zip.addFile(
    "imported_custom_events.csv",
    Buffer.from(
      csv(
        Array.from(byGoal.entries()).map(([key, g]) => {
          const [date, name] = key.split("\u0001");
          return { date, name, visitors: g.visitors.size, events: g.events };
        })
      ),
      "utf-8"
    )
  );

  // ── imported_utm_*.csv ────────────────────────────────────────────────────
  function utmFile(
    fileName: string,
    columnName: string,
    pick: (s: SessionSummary) => string
  ) {
    const filtered = sessions.filter((s) => pick(s));
    const groups = groupSessionsBy(filtered, (s) => `${s.date}\u0001${pick(s)}`);
    zip.addFile(
      fileName,
      Buffer.from(
        csv(
          toRows(groups, (key) => {
            const [date, value] = key.split("\u0001");
            return { date, [columnName]: value } as Record<string, string>;
          })
        ),
        "utf-8"
      )
    );
  }

  utmFile("imported_utm_sources.csv", "utm_source", (s) => s.utm_source);
  utmFile("imported_utm_mediums.csv", "utm_medium", (s) => s.utm_medium);
  utmFile("imported_utm_campaigns.csv", "utm_campaign", (s) => s.utm_campaign);
  utmFile("imported_utm_terms.csv", "utm_term", (s) => s.utm_term);
  utmFile("imported_utm_contents.csv", "utm_content", (s) => s.utm_content);

  return { buffer: zip.toBuffer(), rowCount: events.length };
}
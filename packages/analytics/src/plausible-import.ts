// // packages/analytics/src/import/plausible-import.ts
// //
// // Converts a Plausible "export data" .zip into synthetic events matching the
// // dub_click_events Tinybird schema, and bulk-loads them via Tinybird's
// // Data Source Import API (NOT the streaming /v0/events endpoint — that one
// // is tuned for live traffic, this one is tuned for backfills).
// //
// // MODELING NOTE (read this before trusting the numbers):
// // Plausible's export is a set of independent daily marginal aggregates
// // (pageviews by day, by page, by country, by device, by UTM param, ...).
// // There is no visitor-level join key across files, so we can't reconstruct
// // "this visitor was from France AND used Chrome" as one true event. What we
// // *can* do is make each single-dimension breakdown numerically correct: for
// // every row we synthesize exactly `visitors` distinct sessions dated to that
// // day, with only that file's dimension populated (others "Unknown"), so
// // COUNT(DISTINCT visitor_id) queries on that one dimension match Plausible.
// //
// // Where a row includes `bounces` and `visit_duration`, we go further and
// // synthesize real multi-pageview sessions so bounce rate and average session
// // duration are also approximately correct for that dimension slice:
// //   - the first `bounces` of the row's sessions get exactly 1 pageview
// //     (duration 0) — these correctly register as bounces downstream
// //   - the remaining sessions get >= 2 pageviews, spread across a duration
// //     budget derived from `visit_duration`, so the average comes out close
// //   - rows without bounce/duration columns (locations, exit pages, custom
// //     events) fall back to one isolated pageview per visitor — there's
// //     nothing in the source data to reconstruct a session from there.
// // Cross-dimension filtering on imported data (country AND device together)
// // is still not reliable — that's inherent to the source data, not a bug.

// import AdmZip from "adm-zip";
// import { parse } from "csv-parse/sync";
// import { randomUUID, createHash } from "node:crypto";

// export type TinybirdEvent = Record<string, unknown>;

// export interface PlausibleImportResult {
//   events: TinybirdEvent[];
//   filesParsed: string[];
//   filesSkipped: string[];
//   rowCount: number;
// }

// const KNOWN_FILES = [
//   "imported_visitors.csv",
//   "imported_pages.csv",
//   "imported_sources.csv",
//   "imported_locations.csv",
//   "imported_devices.csv",
//   "imported_browsers.csv",
//   "imported_operating_systems.csv",
//   "imported_entry_pages.csv",
//   "imported_exit_pages.csv",
//   "imported_custom_events.csv",
//   "imported_utm_sources.csv",
//   "imported_utm_mediums.csv",
//   "imported_utm_campaigns.csv",
//   "imported_utm_terms.csv",
//   "imported_utm_contents.csv",
// ] as const;

// // ── Deterministic synthetic ids ─────────────────────────────────────────────
// // Same inputs always produce the same id, so re-parsing the same export file
// // twice doesn't create brand-new random ids (helps if you ever need to dedupe
// // or diff imports).
// function syntheticId(
//   workspaceId: string,
//   namespace: string,
//   date: string,
//   dimensionKey: string,
//   index: number
// ): string {
//   const h = createHash("sha256")
//     .update(`${workspaceId}|${namespace}|${date}|${dimensionKey}|${index}`)
//     .digest("hex");
//   return `plausible_${h.slice(0, 32)}`;
// }

// function randomTimeInDay(date: string): Date {
//   const dayStart = new Date(`${date}T00:00:00Z`).getTime();
//   const jitterMs = Math.floor(Math.random() * 24 * 60 * 60 * 1000);
//   return new Date(dayStart + jitterMs);
// }

// function toClickHouseTimestamp(d: Date): string {
//   return d.toISOString().replace("T", " ").replace("Z", "");
// }

// function baseEvent(params: {
//   workspaceId: string;
//   hostname: string;
//   visitorId: string;
//   sessionId: string;
//   timestamp: Date;
//   overrides?: Partial<TinybirdEvent>;
// }): TinybirdEvent {
//   const { workspaceId, hostname, visitorId, sessionId, timestamp, overrides } =
//     params;

//   return {
//     event_id: randomUUID(),
//     timestamp: toClickHouseTimestamp(timestamp),
//     event_type: "pageview",
//     event_name: "pageview",

//     workspace_id: workspaceId,
//     user_id: "",
//     visitor_id: visitorId,
//     session_id: sessionId,
//     identity_hash: "",

//     utm_source: null,
//     utm_medium: null,
//     utm_campaign: null,
//     utm_content: null,
//     utm_term: null,

//     url: `https://${hostname}/`,
//     hostname,
//     page: "/",
//     entrypage: null,
//     exitlink: null,
//     referer: "(direct)",
//     referer_url: "(direct)",

//     country: "Unknown",
//     city: "Unknown",
//     region: "Unknown",
//     continent: "Unknown",
//     latitude: null,
//     longitude: null,

//     device: "Unknown",
//     device_model: "Unknown",
//     device_vendor: "Unknown",
//     browser: "Unknown",
//     browser_version: "Unknown",
//     os: "Unknown",
//     os_version: "Unknown",
//     engine: "Unknown",
//     engine_version: "Unknown",
//     cpu_architecture: "Unknown",
//     ua: "",
//     bot: 0,

//     ip: null,
//     vercel_region: null,

//     qr: 0,
//     trigger: "page",

//     event_properties: JSON.stringify({ _imported: "plausible" }),

//     revenue: 0,
//     currency: "",

//     ...overrides,
//   };
// }

// /**
//  * Core session synthesizer. Given a row's visitor count, and optionally its
//  * bounce count / total visit duration (seconds) / total pageviews, produces
//  * one or more events per synthetic session so that:
//  *   - COUNT(DISTINCT visitor_id) for this dimension slice == `visitors`
//  *   - bounce rate downstream ~= bounces / visitors
//  *   - avg session duration downstream ~= visitDurationSeconds (avg per visitor)
//  */
// function expandDimensionToSessions(params: {
//   workspaceId: string;
//   hostname: string;
//   date: string;
//   namespace: string; // e.g. "pages", "devices" — keeps ids unique per file
//   dimensionKey: string; // e.g. the page path, device name, etc.
//   visitors: number;
//   bounces?: number; // if omitted, every session is treated as a bounce (1 pageview)
//   visitDurationSeconds?: number; // Plausible reports this as an AVERAGE per visitor
//   pageviews?: number; // total pageviews for the row, if known
//   overrides?: Partial<TinybirdEvent>;
// }): TinybirdEvent[] {
//   const { workspaceId, hostname, date, namespace, dimensionKey, overrides } =
//     params;

//   const N = Math.max(0, Math.floor(params.visitors) || 0);
//   if (N === 0) return [];

//   const B = Math.min(Math.max(0, Math.floor(params.bounces ?? N) || 0), N);
//   const nonBounced = N - B;

//   // Total duration budget (seconds) across all non-bounced sessions.
//   // Plausible's visit_duration is an average-per-visitor figure, so we
//   // multiply back out to a total, then divide across just the non-bounced
//   // sessions (bounced sessions always have 0 duration).
//   const avgDurationPerVisitor = Math.max(0, params.visitDurationSeconds ?? 0);
//   const totalDurationSeconds = avgDurationPerVisitor * N;
//   const durationPerNonBouncedSession =
//     nonBounced > 0 ? totalDurationSeconds / nonBounced : 0;

//   // How many pageviews does each non-bounced session get? We need >= 2 per
//   // session so it doesn't accidentally register as a bounce downstream.
//   const rawPageviews = params.pageviews;
//   const extraPageviews =
//     rawPageviews !== undefined
//       ? Math.max(0, Math.floor(rawPageviews) - N)
//       : nonBounced; // no pageviews column available: assume 2 each as a reasonable default

//   const events: TinybirdEvent[] = [];

//   for (let i = 0; i < N; i++) {
//     const visitorId = syntheticId(workspaceId, `${namespace}_v`, date, dimensionKey, i);
//     const sessionId = syntheticId(workspaceId, `${namespace}_s`, date, dimensionKey, i);
//     const sessionStart = randomTimeInDay(date);

//     if (i < B) {
//       // Bounced: exactly one pageview, zero duration.
//       events.push(
//         baseEvent({
//           workspaceId,
//           hostname,
//           visitorId,
//           sessionId,
//           timestamp: sessionStart,
//           overrides,
//         })
//       );
//       continue;
//     }

//     // Non-bounced: figure out how many pageviews this specific session gets.
//     const nonBouncedIndex = i - B; // 0-based index among non-bounced sessions
//     let pvForSession: number;

//     if (extraPageviews >= nonBounced) {
//       // Enough extra pageviews to give everyone at least 2, distribute the
//       // remainder round-robin.
//       const leftover = extraPageviews - nonBounced;
//       pvForSession =
//         2 +
//         Math.floor(leftover / nonBounced) +
//         (nonBouncedIndex < leftover % nonBounced ? 1 : 0);
//     } else {
//       // Not enough extra pageviews for everyone to get 2 — give as many
//       // sessions 2 pageviews as we can afford, the rest fall back to 1
//       // (these will read as bounces downstream; only happens when the
//       // source file's own numbers are internally inconsistent).
//       pvForSession = nonBouncedIndex < extraPageviews ? 2 : 1;
//     }

//     for (let p = 0; p < pvForSession; p++) {
//       const offsetSeconds =
//         pvForSession > 1
//           ? (durationPerNonBouncedSession * p) / (pvForSession - 1)
//           : 0;
//       const ts = new Date(sessionStart.getTime() + offsetSeconds * 1000);
//       events.push(
//         baseEvent({
//           workspaceId,
//           hostname,
//           visitorId,
//           sessionId,
//           timestamp: ts,
//           overrides,
//         })
//       );
//     }
//   }

//   return events;
// }

// function readCsv(zip: AdmZip, name: string): Record<string, string>[] | null {
//   const entry = zip
//     .getEntries()
//     .find((e) => e.entryName.toLowerCase().endsWith(name));
//   if (!entry) return null;
//   const text = entry.getData().toString("utf-8");
//   if (!text.trim()) return [];
//   return parse(text, { columns: true, skip_empty_lines: true, trim: true });
// }

// function num(row: Record<string, string>, key: string): number | undefined {
//   const v = row[key];
//   if (v === undefined || v === "") return undefined;
//   const n = Number(v);
//   return Number.isFinite(n) ? n : undefined;
// }

// export function parsePlausibleZip(
//   zipBuffer: Buffer,
//   { workspaceId, hostname }: { workspaceId: string; hostname: string }
// ): PlausibleImportResult {
//   const zip = new AdmZip(zipBuffer);
//   const events: TinybirdEvent[] = [];
//   const filesParsed: string[] = [];
//   const filesSkipped: string[] = [];

//   for (const fileName of KNOWN_FILES) {
//     const rows = readCsv(zip, fileName);
//     if (rows === null) {
//       filesSkipped.push(fileName);
//       continue;
//     }
//     filesParsed.push(fileName);

//     for (const row of rows) {
//       const date = row.date;
//       if (!date) continue;

//       const visitors = num(row, "visitors") ?? 0;
//       if (visitors <= 0) continue;

//       switch (fileName) {
//         case "imported_visitors.csv": {
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "visitors",
//               dimensionKey: "total",
//               visitors,
//               bounces: num(row, "bounces"),
//               visitDurationSeconds: num(row, "visit_duration"),
//               pageviews: num(row, "pageviews"),
//             })
//           );
//           break;
//         }

//         case "imported_pages.csv": {
//           const page = row.page || "/";
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "pages",
//               dimensionKey: page,
//               visitors,
//               // no bounces column in this file — treat all as non-bounced
//               // and derive extra pageviews from the file's own pageviews count
//               bounces: 0,
//               visitDurationSeconds: num(row, "visit_duration"),
//               pageviews: num(row, "pageviews"),
//               overrides: { page, url: `https://${hostname}${page}` },
//             })
//           );
//           break;
//         }

//         case "imported_entry_pages.csv": {
//           const entrypage = row.entry_page || "/";
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "entry",
//               dimensionKey: entrypage,
//               visitors,
//               bounces: num(row, "bounces"),
//               visitDurationSeconds: num(row, "visit_duration"),
//               overrides: {
//                 entrypage,
//                 page: entrypage,
//                 url: `https://${hostname}${entrypage}`,
//               },
//             })
//           );
//           break;
//         }

//         case "imported_exit_pages.csv": {
//           // No bounce/duration data available for exit pages — single
//           // isolated pageview per visitor, as before.
//           const exitlink = row.exit_page || "/";
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "exit",
//               dimensionKey: exitlink,
//               visitors,
//               overrides: { exitlink },
//             })
//           );
//           break;
//         }

//         case "imported_sources.csv": {
//           const source = row.source || "(direct)";
//           const refererValue = source === "Direct / None" ? "(direct)" : source;
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "source",
//               dimensionKey: source,
//               visitors,
//               bounces: num(row, "bounces"),
//               visitDurationSeconds: num(row, "visit_duration"),
//               overrides: { referer: refererValue, referer_url: refererValue },
//             })
//           );
//           break;
//         }

//         case "imported_utm_sources.csv": {
//           const utmSource = row.utm_source || "";
//           if (!utmSource) break;
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "utm_source",
//               dimensionKey: utmSource,
//               visitors,
//               bounces: num(row, "bounces"),
//               visitDurationSeconds: num(row, "visit_duration"),
//               overrides: { utm_source: utmSource },
//             })
//           );
//           break;
//         }

//         case "imported_utm_mediums.csv": {
//           const utmMedium = row.utm_medium || "";
//           if (!utmMedium) break;
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "utm_medium",
//               dimensionKey: utmMedium,
//               visitors,
//               bounces: num(row, "bounces"),
//               visitDurationSeconds: num(row, "visit_duration"),
//               overrides: { utm_medium: utmMedium },
//             })
//           );
//           break;
//         }

//         case "imported_utm_campaigns.csv": {
//           const utmCampaign = row.utm_campaign || "";
//           if (!utmCampaign) break;
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "utm_campaign",
//               dimensionKey: utmCampaign,
//               visitors,
//               bounces: num(row, "bounces"),
//               visitDurationSeconds: num(row, "visit_duration"),
//               overrides: { utm_campaign: utmCampaign },
//             })
//           );
//           break;
//         }

//         case "imported_utm_terms.csv": {
//           const utmTerm = row.utm_term || "";
//           if (!utmTerm) break;
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "utm_term",
//               dimensionKey: utmTerm,
//               visitors,
//               bounces: num(row, "bounces"),
//               visitDurationSeconds: num(row, "visit_duration"),
//               overrides: { utm_term: utmTerm },
//             })
//           );
//           break;
//         }

//         case "imported_utm_contents.csv": {
//           const utmContent = row.utm_content || "";
//           if (!utmContent) break;
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "utm_content",
//               dimensionKey: utmContent,
//               visitors,
//               bounces: num(row, "bounces"),
//               visitDurationSeconds: num(row, "visit_duration"),
//               overrides: { utm_content: utmContent },
//             })
//           );
//           break;
//         }

//         case "imported_locations.csv": {
//           // No bounce/duration data for locations — single isolated
//           // pageview per visitor, as before.
//           const country = row.country || "Unknown";
//           const region = row.region || "Unknown";
//           const city = row.city || "Unknown";
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "geo",
//               dimensionKey: `${country}|${region}|${city}`,
//               visitors,
//               overrides: { country, region, city },
//             })
//           );
//           break;
//         }

//         case "imported_devices.csv": {
//           const device = row.device || "Unknown";
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "device",
//               dimensionKey: device,
//               visitors,
//               bounces: num(row, "bounces"),
//               visitDurationSeconds: num(row, "visit_duration"),
//               overrides: { device },
//             })
//           );
//           break;
//         }

//         case "imported_browsers.csv": {
//           const browser = row.browser || "Unknown";
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "browser",
//               dimensionKey: browser,
//               visitors,
//               bounces: num(row, "bounces"),
//               visitDurationSeconds: num(row, "visit_duration"),
//               overrides: { browser },
//             })
//           );
//           break;
//         }

//         case "imported_operating_systems.csv": {
//           const os = row.operating_system || "Unknown";
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "os",
//               dimensionKey: os,
//               visitors,
//               bounces: num(row, "bounces"),
//               visitDurationSeconds: num(row, "visit_duration"),
//               overrides: { os },
//             })
//           );
//           break;
//         }

//         case "imported_custom_events.csv": {
//           // Goal completions — instantaneous events, no session concept.
//           const eventName = row.name || "unknown_event";
//           events.push(
//             ...expandDimensionToSessions({
//               workspaceId,
//               hostname,
//               date,
//               namespace: "custom",
//               dimensionKey: eventName,
//               visitors,
//               overrides: {
//                 event_type: "goals",
//                 event_name: eventName,
//                 trigger: "goal",
//               },
//             })
//           );
//           break;
//         }
//       }
//     }
//   }

//   return { events, filesParsed, filesSkipped, rowCount: events.length };
// }

// // ── Bulk load into Tinybird ────────────────────────────────────────────────
// // Uses the Data Source Import API (mode=append) rather than the streaming
// // events endpoint — this is the correct tool for one-off historical
// // backfills of thousands/millions of rows.
// export async function loadEventsIntoTinybird({
//   events,
//   batchSize = 5000,
// }: {
//   events: TinybirdEvent[];
//   batchSize?: number;
// }): Promise<{ batches: number; rows: number }> {
//   const apiUrl = process.env.TINYBIRDS_API_URL;
//   const apiKey = process.env.TINYBIRDS_API_KEY;
//   if (!apiUrl || !apiKey) {
//     throw new Error("Missing TINYBIRDS_API_URL / TINYBIRDS_API_KEY");
//   }

//   let batches = 0;

//   for (let i = 0; i < events.length; i += batchSize) {
//     const chunk = events.slice(i, i + batchSize);
//     const ndjson = chunk.map((e) => JSON.stringify(e)).join("\n");

//     const form = new FormData();
//     form.append("mode", "append");
//     form.append("name", "dub_click_events");
//     form.append(
//       "csv",
//       new Blob([ndjson], { type: "application/x-ndjson" }),
//       `plausible_import_${Date.now()}_${batches}.ndjson`
//     );

//     const res = await fetch(`${apiUrl}/v0/datasources`, {
//       method: "POST",
//       headers: { Authorization: `Bearer ${apiKey}` },
//       body: form,
//     });

//     if (!res.ok) {
//       const body = await res.text().catch(() => "");
//       throw new Error(
//         `Tinybird import failed (batch ${batches}, status ${res.status}): ${body}`
//       );
//     }

//     batches++;
//   }

//   return { batches, rows: events.length };
// }

// // ── Rollback helper ─────────────────────────────────────────────────────────
// // If an import needs to be undone (wrong file, duplicate run), delete rows
// // tagged as imported for that workspace via Tinybird's Delete API.
// // NOTE: this deletes ALL plausible-imported rows for the workspace — there is
// // no per-import-run id here. Add one (e.g. an `import_id` in event_properties)
// // if you need to support multiple distinct imports per workspace safely.
// export async function deletePlausibleImport({
//   workspaceId,
// }: {
//   workspaceId: string;
// }): Promise<void> {
//   const apiUrl = process.env.TINYBIRDS_API_URL;
//   const apiKey = process.env.TINYBIRDS_API_KEY;
//   if (!apiUrl || !apiKey) {
//     throw new Error("Missing TINYBIRDS_API_URL / TINYBIRDS_API_KEY");
//   }

//   const res = await fetch(
//     `${apiUrl}/v0/datasources/dub_click_events/delete`,
//     {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${apiKey}`,
//         "Content-Type": "application/x-www-form-urlencoded",
//       },
//       body: new URLSearchParams({
//         delete_condition: `workspace_id = '${workspaceId.replace(
//           /'/g,
//           "''"
//         )}' AND event_properties LIKE '%"_imported":"plausible"%'`,
//       }),
//     }
//   );

//   if (!res.ok) {
//     const body = await res.text().catch(() => "");
//     throw new Error(`Tinybird delete failed (${res.status}): ${body}`);
//   }
// }

// packages/analytics/src/import/plausible-import.ts
//
// Converts a Plausible "export data" .zip into synthetic pageview/goal events
// matching the dub_click_events Tinybird schema, then streams them to the same
// Events API endpoint the live tracker uses (see loadEventsIntoTinybird).
//
// MODELING NOTE (read this before trusting the numbers):
// Plausible's export is a set of independent daily marginal aggregates — a
// visitor total per day, plus separate per-page / per-country / per-device /...
// breakdowns for the same day. There is no visitor-level key linking them.
//
// So we treat `imported_visitors.csv` as the single source of truth for the
// visitor/session population: for each day it says how many visitors and how
// many were bounces, and we build exactly that many sessions (bounces = one
// pageview, the rest = two, spread over the day's duration budget). Every other
// file just *decorates* those same sessions — its rows are distributed
// positionally over the day's sessions, tagging each with the row's dimension
// value. Result:
//   - COUNT(DISTINCT visitor_id) overall            == Plausible's visitor total
//   - COUNT(DISTINCT visitor_id) per country/device/page/... == its breakdown
//   - bounce rate / avg session duration            from imported_visitors only
// The positional cross-file join is arbitrary (a given synthetic visitor's
// country is not truly paired with their device), so filtering imported data by
// two dimensions at once stays approximate — inherent to the source, not a bug.
//
// Custom events become goal events folded into the same day's sessions (a goal
// fires within a visit). Plausible's automatic "engagement" pseudo-event is
// dropped — it isn't a user goal.
//
// FILE NAMING NOTE:
// Plausible's export names files with a trailing date-range suffix, e.g.
// `imported_pages_20260731_20260804.csv`. `findEntry` matches that and the bare
// `imported_pages.csv` form, at the zip root or nested one folder deep.

import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { randomUUID, createHash } from "node:crypto";
import { fetchWithRetry } from "@repo/utils";

export type TinybirdEvent = Record<string, unknown>;

export interface PlausibleImportResult {
  events: TinybirdEvent[];
  filesParsed: string[];
  filesSkipped: string[];
  rowCount: number;
}

// Base names (no extension, no date-range suffix) for every file Plausible
// may include in an export. Matching is done against these via regex — see
// `findEntry` below — so both `imported_pages.csv` (older/manual exports)
// and `imported_pages_20260731_20260804.csv` (current exports) resolve.
const KNOWN_FILES = [
  "imported_visitors",
  "imported_pages",
  "imported_sources",
  "imported_locations",
  "imported_devices",
  "imported_browsers",
  "imported_operating_systems",
  "imported_entry_pages",
  "imported_exit_pages",
  "imported_custom_events",
  "imported_utm_sources",
  "imported_utm_mediums",
  "imported_utm_campaigns",
  "imported_utm_terms",
  "imported_utm_contents",
] as const;

type KnownFile = (typeof KNOWN_FILES)[number];

// ── Deterministic synthetic ids ─────────────────────────────────────────────
// Same inputs always produce the same id, so re-parsing the same export file
// twice doesn't create brand-new random ids (helps if you ever need to dedupe
// or diff imports).
function syntheticId(
  workspaceId: string,
  namespace: string,
  date: string,
  dimensionKey: string,
  index: number
): string {
  const h = createHash("sha256")
    .update(`${workspaceId}|${namespace}|${date}|${dimensionKey}|${index}`)
    .digest("hex");
  return `plausible_${h.slice(0, 32)}`;
}

function randomTimeInDay(date: string): Date {
  const dayStart = new Date(`${date}T00:00:00Z`).getTime();
  const jitterMs = Math.floor(Math.random() * 24 * 60 * 60 * 1000);
  return new Date(dayStart + jitterMs);
}

// Match the exact format the live tracking path sends to the same datasource
// (`record-event.ts` uses `new Date().toISOString()`). ClickHouse's
// `DateTime64(3)` JSON parsing is happy with ISO-8601, and staying identical to
// the proven path removes any ambiguity about how the value lands.
function toClickHouseTimestamp(d: Date): string {
  return d.toISOString();
}

function baseEvent(params: {
  workspaceId: string;
  hostname: string;
  visitorId: string;
  sessionId: string;
  timestamp: Date;
  overrides?: Partial<TinybirdEvent>;
}): TinybirdEvent {
  const { workspaceId, hostname, visitorId, sessionId, timestamp, overrides } =
    params;

  return {
    event_id: randomUUID(),
    timestamp: toClickHouseTimestamp(timestamp),
    event_type: "pageview",
    event_name: "pageview",

    workspace_id: workspaceId,
    user_id: "",
    visitor_id: visitorId,
    session_id: sessionId,
    identity_hash: "",

    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,

    url: `https://${hostname}/`,
    hostname,
    page: "/",
    entrypage: null,
    exitlink: null,
    referer: "(direct)",
    referer_url: "(direct)",

    country: "Unknown",
    city: "Unknown",
    region: "Unknown",
    continent: "Unknown",
    latitude: null,
    longitude: null,

    device: "Unknown",
    device_model: "Unknown",
    device_vendor: "Unknown",
    browser: "Unknown",
    browser_version: "Unknown",
    os: "Unknown",
    os_version: "Unknown",
    engine: "Unknown",
    engine_version: "Unknown",
    cpu_architecture: "Unknown",
    ua: "",
    bot: 0,

    ip: null,
    vercel_region: null,

    qr: 0,
    trigger: "page",

    event_properties: JSON.stringify({ _imported: "plausible" }),

    revenue: 0,
    currency: "",

    ...overrides,
  };
}

// Matches both `imported_pages.csv` and the current Plausible export naming
// scheme `imported_pages_20260731_20260804.csv`, optionally nested in a
// folder inside the zip (Plausible's export sometimes wraps files in a
// dated top-level directory).
function findEntry(zip: AdmZip, base: KnownFile) {
  const pattern = new RegExp(
    `(^|/)${base}(_\\d{8}_\\d{8})?\\.csv$`,
    "i"
  );
  return zip.getEntries().find((e) => pattern.test(e.entryName));
}

function readCsv(zip: AdmZip, base: KnownFile): Record<string, string>[] | null {
  const entry = findEntry(zip, base);
  if (!entry) return null;
  const text = entry.getData().toString("utf-8");
  if (!text.trim()) return [];
  // `bom: true` — strip a UTF-8 BOM if present so the first header doesn't come
  // back as "﻿date", which would make every row look like it has no date
  // and get silently dropped.
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });
}

function num(row: Record<string, string>, key: string): number | undefined {
  const v = row[key];
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Hard ceiling on synthesized events. A single serverless invocation holds the
// whole array in memory before upload; past this it will OOM. The route also
// checks rowCount, but that check can't run until parsing finishes — this stops
// the accumulation itself.
const MAX_SYNTHESIZED_EVENTS = 1_500_000;

export class PlausibleImportTooLargeError extends Error {
  constructor(count: number) {
    super(
      `This export expands to more than ${count.toLocaleString()} events, which is too large to import in one pass. Re-export a shorter date range from Plausible and import each part.`
    );
    this.name = "PlausibleImportTooLargeError";
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Model
// ───────────────────────────────────────────────────────────────────────────
//
// `imported_visitors.csv` is the ONLY source of truth for the visitor/session
// population: for each day it gives `visitors`, `bounces`, `visits` and
// `visit_duration` (average seconds per visitor). We build exactly that many
// sessions per day — `bounces` of them single-pageview, the rest 2 pageviews
// spread over the day's duration budget — with deterministic ids.
//
// Every other file (pages, sources, locations, devices, browsers, OS, entry
// pages) is a *decoration* of that same population, not a new one. Its rows
// are distributed positionally over the day's existing sessions, tagging each
// with the row's dimension value. So:
//   - COUNT(DISTINCT visitor_id) globally  == Plausible's visitor total
//   - COUNT(DISTINCT visitor_id) per country/device/page/... == Plausible's
//     per-dimension breakdown
//   - bounce rate / avg duration come only from imported_visitors
// The positional join across dimension files is arbitrary (visitor 3's country
// is not truly visitor 3's device), so cross-dimension filtering on imported
// data stays approximate — that's inherent to Plausible's marginal-aggregate
// export, not a bug.
//
// Custom events become goal events folded into the same-day sessions (a goal
// fires *within* a visit, exactly as the live tracker records it), so they add
// to goal counts without inventing new visitors.

type SessionDraft = {
  date: string;
  visitorId: string;
  sessionId: string;
  startMs: number;
  pageviews: number; // 1 = bounce
  durationSec: number; // total, spread across the pageviews
  page?: string;
  entrypage?: string;
  exitlink?: string;
  country?: string;
  region?: string;
  city?: string;
  device?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  referer?: string;
  refererUrl?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

function int(v: number | undefined): number {
  return v !== undefined && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

// Plausible's region column is already `<countryCode>-<subdivision>`
// (e.g. "IN-PB"); Convrs's `regions` breakdown re-prefixes the country, so we
// store only the subdivision part.
function regionSubdivision(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const dash = raw.indexOf("-");
  return dash >= 0 ? raw.slice(dash + 1) : raw;
}

function groupRowsByDate(
  rows: Record<string, string>[]
): Map<string, Record<string, string>[]> {
  const map = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    if (!row.date) continue;
    const list = map.get(row.date) ?? [];
    list.push(row);
    map.set(row.date, list);
  }
  return map;
}

// ───────────────────────────────────────────────────────────────────────────
// Dashboard "Export to CSV" format
// ───────────────────────────────────────────────────────────────────────────
//
// The download icon on the Plausible dashboard produces a DIFFERENT zip from
// the Settings → Imports & Exports export handled above:
//   - files are bare (`visitors.csv`, `pages.csv`, `countries.csv`, …) — no
//     `imported_` prefix and no date-range suffix
//   - ONLY `visitors.csv` is a daily time series; every other file is a single
//     aggregate over the whole export window (a `name` column + counts)
//   - there's no `bounces` column, only a `bounce_rate` percentage
//   - geo is split into countries.csv / regions.csv / cities.csv, and the
//     values are display names ("India", "Punjab", "Ludhiāna") not ISO codes
//   - UA is split into browsers.csv / browser_versions.csv /
//     operating_systems.csv / operating_system_versions.csv
//   - goals live in conversions.csv (`name,unique_conversions,total_conversions`)
//   - there are extra channels.csv / referrers.csv files
//
// Model: build the per-day session pool from visitors.csv the same way the
// native path does (bounces derived from `bounce_rate`), then decorate that
// pool — flattened across the whole window, since the dimension files carry no
// per-day granularity — positionally, rarest value first, first-write-wins.
// Same approximation caveat as the native path: a synthetic visitor's country
// isn't truly paired with their device.

const DASHBOARD_BARE_FILES = [
  "visitors",
  "pages",
  "entry_pages",
  "exit_pages",
  "sources",
  "channels",
  "referrers",
  "countries",
  "regions",
  "cities",
  "devices",
  "browsers",
  "browser_versions",
  "operating_systems",
  "operating_system_versions",
  "conversions",
  "custom_props",
  "utm_sources",
  "utm_mediums",
  "utm_campaigns",
  "utm_contents",
  "utm_terms",
] as const;
type DashboardFile = (typeof DASHBOARD_BARE_FILES)[number];

// Matches `visitors.csv` but NOT `imported_visitors.csv` — the `(^|/)` anchor
// requires a slash or the string start immediately before the base name, and
// `imported_visitors.csv` has an underscore there. Likewise `sources` won't
// match `utm_sources.csv`, nor `pages` match `entry_pages.csv`.
function findBareEntry(zip: AdmZip, base: DashboardFile) {
  const pattern = new RegExp(`(^|/)${base}\\.csv$`, "i");
  return zip.getEntries().find((e) => pattern.test(e.entryName));
}

function isDashboardExport(zip: AdmZip): boolean {
  return findBareEntry(zip, "visitors") != null;
}

// Plausible's "Top Sources" names → the referrer host Convrs's channel
// classifier and referrer grouping understand. Anything not listed falls
// through unchanged (already a hostname for most real referrers).
const PLAUSIBLE_SOURCE_TO_HOST: Record<string, string> = {
  "x (twitter)": "twitter.com",
  twitter: "twitter.com",
  x: "twitter.com",
  google: "google.com",
  bing: "bing.com",
  duckduckgo: "duckduckgo.com",
  "yahoo!": "yahoo.com",
  yahoo: "yahoo.com",
  ecosia: "ecosia.org",
  reddit: "reddit.com",
  "hacker news": "news.ycombinator.com",
  facebook: "facebook.com",
  instagram: "instagram.com",
  linkedin: "linkedin.com",
  youtube: "youtube.com",
  "product hunt": "producthunt.com",
  github: "github.com",
  substack: "substack.com",
  perplexity: "perplexity.ai",
};

function sourceToReferer(raw: string | undefined): string {
  const name = (raw || "").trim();
  if (!name || name === "Direct / None") return "(direct)";
  return PLAUSIBLE_SOURCE_TO_HOST[name.toLowerCase()] ?? name;
}

// Dashboard export gives country display names ("India"); Convrs stores /
// renders ISO-3166-1 alpha-2 codes (the dashboard's Locations card does
// `COUNTRIES[code]` and builds a flag URL from it). This inverts the same
// name→code table, plus the handful of alternate spellings Plausible uses.
// Kept inline rather than imported from @repo/utils so the importer stays
// self-contained. Lower-cased keys; unrecognised names are passed through
// unchanged rather than dropping the row.
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  afghanistan: "AF", albania: "AL", algeria: "DZ", "american samoa": "AS",
  andorra: "AD", angola: "AO", anguilla: "AI", antarctica: "AQ",
  "antigua and barbuda": "AG", argentina: "AR", armenia: "AM", aruba: "AW",
  australia: "AU", austria: "AT", azerbaijan: "AZ", bahamas: "BS",
  bahrain: "BH", bangladesh: "BD", barbados: "BB", belarus: "BY",
  belgium: "BE", belize: "BZ", benin: "BJ", bermuda: "BM", bhutan: "BT",
  bolivia: "BO", "bosnia and herzegovina": "BA", botswana: "BW",
  "bouvet island": "BV", brazil: "BR", "british indian ocean territory": "IO",
  "brunei darussalam": "BN", brunei: "BN", bulgaria: "BG", "burkina faso": "BF",
  burundi: "BI", cambodia: "KH", cameroon: "CM", canada: "CA",
  "cape verde": "CV", "cabo verde": "CV", "cayman islands": "KY",
  "central african republic": "CF", chad: "TD", chile: "CL", china: "CN",
  "christmas island": "CX", "cocos (keeling) islands": "CC", colombia: "CO",
  comoros: "KM", "congo (republic)": "CG", congo: "CG",
  "congo (democratic republic)": "CD", "dr congo": "CD", "cook islands": "CK",
  "costa rica": "CR", "ivory coast": "CI", "côte d'ivoire": "CI", croatia: "HR",
  cuba: "CU", cyprus: "CY", "czech republic": "CZ", czechia: "CZ",
  denmark: "DK", djibouti: "DJ", dominica: "DM", "dominican republic": "DO",
  ecuador: "EC", egypt: "EG", "el salvador": "SV", "equatorial guinea": "GQ",
  eritrea: "ER", estonia: "EE", ethiopia: "ET", "falkland islands": "FK",
  "faroe islands": "FO", fiji: "FJ", finland: "FI", france: "FR",
  "french guiana": "GF", "french polynesia": "PF",
  "french southern territories": "TF", gabon: "GA", gambia: "GM",
  georgia: "GE", germany: "DE", ghana: "GH", gibraltar: "GI", greece: "GR",
  greenland: "GL", grenada: "GD", guadeloupe: "GP", guam: "GU",
  guatemala: "GT", guinea: "GN", "guinea-bissau": "GW", guyana: "GY",
  haiti: "HT", "heard island and mcdonald islands": "HM", "vatican city": "VA",
  honduras: "HN", "hong kong": "HK", hungary: "HU", iceland: "IS",
  india: "IN", indonesia: "ID", iran: "IR", iraq: "IQ", ireland: "IE",
  israel: "IL", italy: "IT", jamaica: "JM", japan: "JP", jordan: "JO",
  kazakhstan: "KZ", kenya: "KE", kiribati: "KI", "north korea": "KP",
  "south korea": "KR", kuwait: "KW", kyrgyzstan: "KG", laos: "LA",
  latvia: "LV", lebanon: "LB", lesotho: "LS", liberia: "LR", libya: "LY",
  liechtenstein: "LI", lithuania: "LT", luxembourg: "LU", macao: "MO",
  macau: "MO", madagascar: "MG", malawi: "MW", malaysia: "MY", maldives: "MV",
  mali: "ML", malta: "MT", "marshall islands": "MH", martinique: "MQ",
  mauritania: "MR", mauritius: "MU", mayotte: "YT", mexico: "MX",
  micronesia: "FM", moldova: "MD", monaco: "MC", mongolia: "MN",
  montserrat: "MS", morocco: "MA", mozambique: "MZ", myanmar: "MM",
  "myanmar (burma)": "MM", namibia: "NA", nauru: "NR", nepal: "NP",
  netherlands: "NL", "new caledonia": "NC", "new zealand": "NZ",
  nicaragua: "NI", niger: "NE", nigeria: "NG", niue: "NU",
  "norfolk island": "NF", macedonia: "MK", "north macedonia": "MK",
  "northern mariana islands": "MP", norway: "NO", oman: "OM", pakistan: "PK",
  palau: "PW", palestine: "PS", panama: "PA", "papua new guinea": "PG",
  paraguay: "PY", peru: "PE", philippines: "PH", pitcairn: "PN", poland: "PL",
  portugal: "PT", "puerto rico": "PR", qatar: "QA", reunion: "RE",
  "réunion": "RE", romania: "RO", russia: "RU", rwanda: "RW",
  "saint helena": "SH", "saint kitts and nevis": "KN", "saint lucia": "LC",
  "saint pierre and miquelon": "PM", "saint vincent and the grenadines": "VC",
  samoa: "WS", "san marino": "SM", "sao tome and principe": "ST",
  "saudi arabia": "SA", senegal: "SN", seychelles: "SC", "sierra leone": "SL",
  singapore: "SG", slovakia: "SK", slovenia: "SI", "solomon islands": "SB",
  somalia: "SO", "south africa": "ZA",
  "south georgia and the south sandwich islands": "GS", spain: "ES",
  "sri lanka": "LK", sudan: "SD", suriname: "SR", "svalbard and jan mayen": "SJ",
  eswatini: "SZ", swaziland: "SZ", sweden: "SE", switzerland: "CH",
  "syrian arab republic": "SY", syria: "SY", taiwan: "TW", tajikistan: "TJ",
  tanzania: "TZ", thailand: "TH", "timor-leste": "TL", "east timor": "TL",
  togo: "TG", tokelau: "TK", tonga: "TO", "trinidad and tobago": "TT",
  tunisia: "TN", turkey: "TR", "türkiye": "TR", turkmenistan: "TM",
  "turks and caicos islands": "TC", tuvalu: "TV", uganda: "UG", ukraine: "UA",
  "united arab emirates": "AE", "united kingdom": "GB", "united states": "US",
  "united states of america": "US",
  "united states minor outlying islands": "UM", uruguay: "UY",
  uzbekistan: "UZ", vanuatu: "VU", venezuela: "VE", vietnam: "VN",
  "virgin islands, british": "VG", "british virgin islands": "VG",
  "virgin islands, u.s.": "VI", "u.s. virgin islands": "VI",
  "wallis and futuna": "WF", "western sahara": "EH", yemen: "YE", zambia: "ZM",
  zimbabwe: "ZW", "åland islands": "AX",
  "bonaire, sint eustatius and saba": "BQ", "curaçao": "CW", guernsey: "GG",
  "isle of man": "IM", jersey: "JE", montenegro: "ME", "saint barthélemy": "BL",
  "saint martin (french part)": "MF", serbia: "RS",
  "sint maarten (dutch part)": "SX", "south sudan": "SS", kosovo: "XK",
};

function countryNameToCode(raw: string | undefined): string | undefined {
  const name = (raw || "").trim();
  if (!name) return undefined;
  if (/^[A-Za-z]{2}$/.test(name)) return name.toUpperCase();
  return COUNTRY_NAME_TO_CODE[name.toLowerCase()] ?? name;
}

export function parseDashboardExport(
  zip: AdmZip,
  { workspaceId, hostname }: { workspaceId: string; hostname: string }
): PlausibleImportResult {
  const filesParsed: string[] = [];
  const filesSkipped: string[] = [];
  const read = (base: DashboardFile): Record<string, string>[] | null => {
    const entry = findBareEntry(zip, base);
    if (!entry) {
      if (!filesSkipped.includes(base)) filesSkipped.push(base);
      return null;
    }
    if (!filesParsed.includes(base)) filesParsed.push(base);
    const text = entry.getData().toString("utf-8");
    if (!text.trim()) return [];
    return parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    });
  };

  // ── 1. Session pool from visitors.csv (the only dated file) ───────────────
  const sessionsByDate = new Map<string, SessionDraft[]>();
  const visitorRows = read("visitors");
  for (const row of visitorRows ?? []) {
    const date = row.date;
    if (!date) continue;
    const V = int(num(row, "visitors"));
    if (V === 0) continue;
    if (totalSessions(sessionsByDate) + V > MAX_SYNTHESIZED_EVENTS / 3) {
      throw new PlausibleImportTooLargeError(MAX_SYNTHESIZED_EVENTS);
    }

    // No `bounces` column in this format — derive it from `bounce_rate` (%).
    const bounceRate = num(row, "bounce_rate") ?? 0;
    const B = Math.min(Math.max(0, Math.round((bounceRate / 100) * V)), V);
    const nonBounced = V - B;
    const pageviews = int(num(row, "pageviews")) || V;
    const extra = Math.max(0, pageviews - V);
    // In the dashboard "Export to CSV" this column backs the per-day
    // visit-duration graph, so it's the AVERAGE seconds per visit — multiply
    // back out to the day's total. (The `imported_*` format differs: there
    // `visit_duration` is already the total.)
    const avgDurationPerVisitor = Math.max(0, num(row, "visit_duration") ?? 0);
    const totalDuration = avgDurationPerVisitor * V;
    const durationPerNonBounced =
      nonBounced > 0 ? totalDuration / nonBounced : 0;

    const drafts: SessionDraft[] = [];
    for (let i = 0; i < V; i++) {
      const isBounce = i < B;
      let pv = 1;
      if (!isBounce) {
        const idx = i - B;
        pv =
          extra >= nonBounced
            ? 2 +
              Math.floor((extra - nonBounced) / nonBounced) +
              (idx < (extra - nonBounced) % nonBounced ? 1 : 0)
            : 2;
      }
      drafts.push({
        date,
        visitorId: syntheticId(workspaceId, "v", date, "", i),
        sessionId: syntheticId(workspaceId, "s", date, "", i),
        startMs: randomTimeInDay(date).getTime(),
        pageviews: pv,
        durationSec: isBounce ? 0 : durationPerNonBounced,
      });
    }
    sessionsByDate.set(date, drafts);
  }

  // Flatten the pool in chronological order so decoration is deterministic.
  const pool: SessionDraft[] = [];
  for (const date of [...sessionsByDate.keys()].sort()) {
    pool.push(...(sessionsByDate.get(date) ?? []));
  }

  // ── 2. Decorate the flat pool from each period-aggregate file ─────────────
  // Rows processed rarest-first, first-write-wins per session — a low-volume
  // value claims a slot before the common ones fill the rest. When a file's
  // total exceeds the visitor count the surplus wraps (modulo) and no-ops
  // against already-filled slots rather than inventing visitors.
  const decorate = (
    base: DashboardFile,
    countKey: string,
    field: keyof SessionDraft,
    apply: (s: SessionDraft, row: Record<string, string>) => void
  ) => {
    const rows = read(base);
    if (!rows || pool.length === 0) return;
    const usable = rows
      .filter((r) => (r.name ?? "").trim() && r.name !== "(none)")
      .sort((a, b) => int(num(a, countKey)) - int(num(b, countKey)));
    let cursor = 0;
    for (const row of usable) {
      const count = int(num(row, countKey));
      for (let k = 0; k < count; k++) {
        const s = pool[cursor % pool.length];
        cursor++;
        if (s[field] === undefined) apply(s, row);
      }
    }
  };

  decorate("pages", "visitors", "page", (s, row) => {
    s.page = row.name || "/";
  });
  decorate("entry_pages", "unique_entrances", "entrypage", (s, row) => {
    s.entrypage = row.name || "/";
  });
  decorate("exit_pages", "unique_exits", "exitlink", (s, row) => {
    s.exitlink = row.name || "/";
  });
  decorate("sources", "visitors", "referer", (s, row) => {
    const referer = sourceToReferer(row.name);
    s.referer = referer;
    s.refererUrl = referer;
  });
  decorate("countries", "visitors", "country", (s, row) => {
    const code = countryNameToCode(row.name);
    if (code) s.country = code;
  });
  decorate("regions", "visitors", "region", (s, row) => {
    if (row.name) s.region = row.name;
  });
  decorate("cities", "visitors", "city", (s, row) => {
    if (row.name) s.city = row.name;
  });
  decorate("devices", "visitors", "device", (s, row) => {
    if (row.name) s.device = row.name;
  });
  decorate("browsers", "visitors", "browser", (s, row) => {
    if (row.name) s.browser = row.name;
  });
  decorate("operating_systems", "visitors", "os", (s, row) => {
    if (row.name) s.os = row.name;
  });
  decorate("utm_sources", "visitors", "utm_source", (s, row) => {
    if (row.name) s.utm_source = row.name;
  });
  decorate("utm_mediums", "visitors", "utm_medium", (s, row) => {
    if (row.name) s.utm_medium = row.name;
  });
  decorate("utm_campaigns", "visitors", "utm_campaign", (s, row) => {
    if (row.name) s.utm_campaign = row.name;
  });
  decorate("utm_contents", "visitors", "utm_content", (s, row) => {
    if (row.name) s.utm_content = row.name;
  });
  decorate("utm_terms", "visitors", "utm_term", (s, row) => {
    if (row.name) s.utm_term = row.name;
  });

  // channels.csv / referrers.csv / *_versions.csv / custom_props.csv carry
  // nothing Convrs stores as its own column (channel is derived from referer
  // at query time). Record them as read so the summary is honest.
  for (const extra of [
    "channels",
    "referrers",
    "browser_versions",
    "operating_system_versions",
    "custom_props",
  ] as const) {
    if (findBareEntry(zip, extra)) {
      if (!filesParsed.includes(extra)) filesParsed.push(extra);
    } else if (!filesSkipped.includes(extra)) {
      filesSkipped.push(extra);
    }
  }

  // ── 3. Emit pageview events ──────────────────────────────────────────────
  const events: TinybirdEvent[] = [];
  const overridesFor = (s: SessionDraft): Partial<TinybirdEvent> => {
    const page = s.page ?? s.entrypage ?? "/";
    // The UTM and campaign breakdowns read utm_* out of the `url` query string
    // (extractURLParameter), not the utm_* columns — so fold them into the url.
    const q = new URLSearchParams();
    if (s.utm_source) q.set("utm_source", s.utm_source);
    if (s.utm_medium) q.set("utm_medium", s.utm_medium);
    if (s.utm_campaign) q.set("utm_campaign", s.utm_campaign);
    if (s.utm_content) q.set("utm_content", s.utm_content);
    if (s.utm_term) q.set("utm_term", s.utm_term);
    const qs = q.toString();
    return {
      page,
      url: `https://${hostname}${page}${qs ? `?${qs}` : ""}`,
      entrypage: s.entrypage ?? null,
      exitlink: s.exitlink ?? null,
      referer: s.referer ?? "(direct)",
      referer_url: s.refererUrl ?? "(direct)",
      country: s.country ?? "Unknown",
      region: s.region ?? "Unknown",
      city: s.city ?? "Unknown",
      device: s.device ?? "Unknown",
      browser: s.browser ?? "Unknown",
      os: s.os ?? "Unknown",
      utm_source: s.utm_source ?? null,
      utm_medium: s.utm_medium ?? null,
      utm_campaign: s.utm_campaign ?? null,
      utm_content: s.utm_content ?? null,
      utm_term: s.utm_term ?? null,
    };
  };

  for (const s of pool) {
    for (let p = 0; p < s.pageviews; p++) {
      const offset =
        s.pageviews > 1 ? (s.durationSec * p) / (s.pageviews - 1) : 0;
      events.push(
        baseEvent({
          workspaceId,
          hostname,
          visitorId: s.visitorId,
          sessionId: s.sessionId,
          timestamp: new Date(s.startMs + offset * 1000),
          overrides: overridesFor(s),
        })
      );
    }
  }

  // ── 4. conversions.csv → goals, folded into the same-day sessions ────────
  const conversionRows = read("conversions");
  for (const row of conversionRows ?? []) {
    const name = (row.name || "").trim();
    if (!name || name.toLowerCase() === "engagement") continue;
    const fires = int(
      num(row, "total_conversions") ??
        num(row, "unique_conversions") ??
        num(row, "visitors")
    );
    if (fires === 0 || pool.length === 0) continue;
    if (events.length + fires > MAX_SYNTHESIZED_EVENTS) {
      throw new PlausibleImportTooLargeError(MAX_SYNTHESIZED_EVENTS);
    }
    for (let i = 0; i < fires; i++) {
      const s = pool[i % pool.length];
      events.push(
        baseEvent({
          workspaceId,
          hostname,
          visitorId: s.visitorId,
          sessionId: s.sessionId,
          timestamp: new Date(s.startMs + Math.floor(Math.random() * 60_000)),
          overrides: {
            ...overridesFor(s),
            event_type: "goals",
            event_name: name,
            trigger: "goal",
          },
        })
      );
    }
  }

  return {
    events,
    filesParsed: [...new Set(filesParsed)],
    filesSkipped: [...new Set(filesSkipped)],
    rowCount: events.length,
  };
}

export function parsePlausibleZip(
  zipBuffer: Buffer,
  { workspaceId, hostname }: { workspaceId: string; hostname: string }
): PlausibleImportResult {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
    zip.getEntries();
  } catch {
    throw new Error(
      "Could not read this file as a zip archive. Upload the .zip exactly as downloaded from Plausible (Settings → Imports & Exports → Export)."
    );
  }

  // Two different Plausible zips reach this function:
  //  1. Settings → Imports & Exports → Export: `imported_*.csv` files, every
  //     file dated — handled by the rest of this function.
  //  2. The dashboard's "Export to CSV" download icon: bare `visitors.csv`,
  //     `pages.csv`, … where only visitors.csv is a daily series and the rest
  //     are period aggregates — handled by parseDashboardExport.
  const hasNativeImportFiles = KNOWN_FILES.some((f) => findEntry(zip, f));
  if (!hasNativeImportFiles && isDashboardExport(zip)) {
    return parseDashboardExport(zip, { workspaceId, hostname });
  }

  const filesParsed: string[] = [];
  const filesSkipped: string[] = [];
  const read = (base: KnownFile): Record<string, string>[] | null => {
    const rows = readCsv(zip, base);
    if (rows === null) filesSkipped.push(base);
    else filesParsed.push(base);
    return rows;
  };

  // ── 1. Build the per-day session population from imported_visitors ────────
  const sessionsByDate = new Map<string, SessionDraft[]>();

  const visitorRows = read("imported_visitors");
  for (const row of visitorRows ?? []) {
    const date = row.date;
    if (!date) continue;
    const V = int(num(row, "visitors"));
    if (V === 0) continue;
    if (
      totalSessions(sessionsByDate) + V >
      MAX_SYNTHESIZED_EVENTS / 3
    ) {
      throw new PlausibleImportTooLargeError(MAX_SYNTHESIZED_EVENTS);
    }

    const bouncesRaw = num(row, "bounces");
    const B = Math.min(bouncesRaw !== undefined ? int(bouncesRaw) : V, V);
    const nonBounced = V - B;
    const pageviews = int(num(row, "pageviews")) || V;
    const extra = Math.max(0, pageviews - V);
    // Plausible's `visit_duration` is the TOTAL seconds across the day's visits
    // (bounces contribute 0), NOT a per-visit average — so spread it straight
    // across the non-bounced sessions. Downstream avg-session-duration then
    // divides by all sessions and matches Plausible's number.
    const totalDuration = Math.max(0, num(row, "visit_duration") ?? 0);
    const durationPerNonBounced =
      nonBounced > 0 ? totalDuration / nonBounced : 0;

    const drafts: SessionDraft[] = [];
    for (let i = 0; i < V; i++) {
      const isBounce = i < B;
      let pv = 1;
      if (!isBounce) {
        // Non-bounced sessions always get ≥ 2 pageviews so they can't re-read
        // as a bounce; extra pageviews beyond 2/session are spread round-robin.
        const idx = i - B;
        pv =
          extra >= nonBounced
            ? 2 +
              Math.floor((extra - nonBounced) / nonBounced) +
              (idx < (extra - nonBounced) % nonBounced ? 1 : 0)
            : 2;
      }
      drafts.push({
        date,
        visitorId: syntheticId(workspaceId, "v", date, "", i),
        sessionId: syntheticId(workspaceId, "s", date, "", i),
        startMs: randomTimeInDay(date).getTime(),
        pageviews: pv,
        durationSec: isBounce ? 0 : durationPerNonBounced,
      });
    }
    sessionsByDate.set(date, drafts);
  }

  // Fallback pool for a date only present in dimension files (rare — Plausible
  // normally emits imported_visitors for every day with traffic).
  const poolFor = (date: string, atLeast: number): SessionDraft[] => {
    let pool = sessionsByDate.get(date);
    if (!pool) {
      pool = [];
      sessionsByDate.set(date, pool);
    }
    for (let i = pool.length; i < atLeast; i++) {
      pool.push({
        date,
        visitorId: syntheticId(workspaceId, "v", date, "", i),
        sessionId: syntheticId(workspaceId, "s", date, "", i),
        startMs: randomTimeInDay(date).getTime(),
        // We have no bounce/duration signal for a session that only shows up in
        // a dimension file — treat it as a single-pageview visit.
        pageviews: 1,
        durationSec: 0,
      });
    }
    return pool;
  };

  // ── 2. Decorate the population from each dimension file ───────────────────
  // For a file's rows on a given day, walk the day's sessions in order,
  // assigning `count` sessions per row. Rows are processed rarest-first so a
  // low-volume dimension value (e.g. a single visit to /contact) claims a
  // session before the common values fill the rest; assignment is
  // first-write-wins per session so those rare values aren't overwritten. When
  // a file's day total exceeds imported_visitors' count, assignment wraps
  // (modulo) so the popular values still cover every remaining session rather
  // than the visitor count ballooning.
  const decorate = (
    base: KnownFile,
    countKey: string,
    field: keyof SessionDraft,
    apply: (s: SessionDraft, row: Record<string, string>) => void
  ) => {
    const rows = read(base);
    if (!rows) return;
    for (const [date, dayRowsRaw] of groupRowsByDate(rows)) {
      const dayRows = [...dayRowsRaw].sort(
        (a, b) => int(num(a, countKey)) - int(num(b, countKey))
      );
      const total = dayRows.reduce((n, r) => n + int(num(r, countKey)), 0);
      if (total === 0) continue;
      const pool = poolFor(date, Math.min(total, dayRows.length || 1));
      if (pool.length === 0) continue;
      let cursor = 0;
      for (const row of dayRows) {
        const count = int(num(row, countKey));
        for (let k = 0; k < count; k++) {
          const s = pool[cursor % pool.length];
          cursor++;
          if (s[field] === undefined) apply(s, row);
        }
      }
    }
  };

  decorate("imported_pages", "visitors", "page", (s, row) => {
    s.page = row.page || "/";
  });
  decorate("imported_entry_pages", "visitors", "entrypage", (s, row) => {
    s.entrypage = row.entry_page || "/";
  });
  decorate("imported_exit_pages", "visitors", "exitlink", (s, row) => {
    s.exitlink = row.exit_page || "/";
  });
  decorate("imported_sources", "visitors", "referer", (s, row) => {
    const source = (row.source || "").trim();
    const referer =
      !source || source === "Direct / None" ? "(direct)" : source;
    s.referer = referer;
    s.refererUrl = row.referrer ? row.referrer : referer;
    if (row.utm_source) s.utm_source = row.utm_source;
    if (row.utm_medium) s.utm_medium = row.utm_medium;
    if (row.utm_campaign) s.utm_campaign = row.utm_campaign;
    if (row.utm_content) s.utm_content = row.utm_content;
    if (row.utm_term) s.utm_term = row.utm_term;
  });
  decorate("imported_locations", "visitors", "country", (s, row) => {
    if (row.country) s.country = row.country;
    const region = regionSubdivision(row.region);
    if (region) s.region = region;
    // Plausible's `city` column is a numeric geoname id, not a name — skip it.
  });
  decorate("imported_devices", "visitors", "device", (s, row) => {
    if (row.device) s.device = row.device;
  });
  decorate("imported_browsers", "visitors", "browser", (s, row) => {
    if (row.browser) s.browser = row.browser;
    if (row.browser_version) s.browserVersion = row.browser_version;
  });
  decorate("imported_operating_systems", "visitors", "os", (s, row) => {
    if (row.operating_system) s.os = row.operating_system;
    if (row.operating_system_version)
      s.osVersion = row.operating_system_version;
  });

  // These files never appear in real Plausible exports (UTM is folded into
  // imported_sources), but older/manual exports may include them — record them
  // as skipped so the count is honest.
  for (const legacy of [
    "imported_utm_sources",
    "imported_utm_mediums",
    "imported_utm_campaigns",
    "imported_utm_terms",
    "imported_utm_contents",
  ] as const) {
    if (findEntry(zip, legacy)) {
      decorate(legacy, "visitors", "utm_source", (s, row) => {
        if (row.utm_source) s.utm_source = row.utm_source;
        if (row.utm_medium) s.utm_medium = row.utm_medium;
        if (row.utm_campaign) s.utm_campaign = row.utm_campaign;
        if (row.utm_term) s.utm_term = row.utm_term;
        if (row.utm_content) s.utm_content = row.utm_content;
      });
    } else {
      filesSkipped.push(legacy);
    }
  }

  // ── 3. Emit pageview events ──────────────────────────────────────────────
  const events: TinybirdEvent[] = [];
  const emit = (
    s: SessionDraft,
    timestamp: Date,
    extra: Partial<TinybirdEvent>
  ) => {
    const page = s.page ?? s.entrypage ?? "/";
    events.push(
      baseEvent({
        workspaceId,
        hostname,
        visitorId: s.visitorId,
        sessionId: s.sessionId,
        timestamp,
        overrides: {
          page,
          url: `https://${hostname}${page}`,
          entrypage: s.entrypage ?? null,
          exitlink: s.exitlink ?? null,
          referer: s.referer ?? "(direct)",
          referer_url: s.refererUrl ?? "(direct)",
          country: s.country ?? "Unknown",
          region: s.region ?? "Unknown",
          city: "Unknown",
          device: s.device ?? "Unknown",
          browser: s.browser ?? "Unknown",
          browser_version: s.browserVersion ?? "Unknown",
          os: s.os ?? "Unknown",
          os_version: s.osVersion ?? "Unknown",
          utm_source: s.utm_source ?? null,
          utm_medium: s.utm_medium ?? null,
          utm_campaign: s.utm_campaign ?? null,
          utm_content: s.utm_content ?? null,
          utm_term: s.utm_term ?? null,
          ...extra,
        },
      })
    );
  };

  for (const drafts of sessionsByDate.values()) {
    for (const s of drafts) {
      for (let p = 0; p < s.pageviews; p++) {
        const offset =
          s.pageviews > 1 ? (s.durationSec * p) / (s.pageviews - 1) : 0;
        emit(s, new Date(s.startMs + offset * 1000), {});
      }
    }
  }

  // ── 4. Custom events → goals, folded into the same-day sessions ──────────
  // A goal fires within a visit, exactly as the live tracker records it, so
  // goal events reuse the visitor + session of a same-day pageview session.
  // That keeps goal/conversion counts attributed to real visitors without
  // inventing new ones, at the cost of nudging bounce rate down on days with
  // heavy goal volume (a folded goal turns a 1-pageview bounce into a
  // 2-event session).
  const customRows = read("imported_custom_events");
  for (const row of customRows ?? []) {
    const date = row.date;
    if (!date) continue;
    const name = (row.name || "unknown_event").trim();
    // "engagement" is Plausible's automatic engagement pseudo-event (scroll
    // depth / active time), not a user-defined goal — it fires on nearly every
    // pageview and would swamp the real custom events and the bounce rate.
    if (name.toLowerCase() === "engagement") continue;
    // `events` = total fires; fall back to `visitors` for older exports.
    const fires = int(num(row, "events") ?? num(row, "visitors"));
    if (fires === 0) continue;
    const pool = sessionsByDate.get(date);
    if (!pool || pool.length === 0) continue;
    if (events.length + fires > MAX_SYNTHESIZED_EVENTS) {
      throw new PlausibleImportTooLargeError(MAX_SYNTHESIZED_EVENTS);
    }
    for (let i = 0; i < fires; i++) {
      const s = pool[i % pool.length];
      emit(s, new Date(s.startMs + Math.floor(Math.random() * 60_000)), {
        event_type: "goals",
        event_name: name,
        trigger: "goal",
      });
    }
  }

  return {
    events,
    filesParsed: [...new Set(filesParsed)],
    filesSkipped: [...new Set(filesSkipped)],
    rowCount: events.length,
  };
}

function totalSessions(m: Map<string, SessionDraft[]>): number {
  let n = 0;
  for (const v of m.values()) n += v.length;
  return n;
}

// ── Bulk load into Tinybird ────────────────────────────────────────────────
// Sends the synthesized rows to the same landing datasource the live tracker
// writes to (`dub_click_events`, via the Events API), in NDJSON batches. We do
// NOT pass `wait=true`: for a backfill of many thousands of rows, blocking on
// each batch's full ingest + materialized-view write pushes the whole request
// past the serverless time limit. Tinybird still validates the payload shape
// on accept and queues the rows, which land within seconds.
export async function loadEventsIntoTinybird({
  events,
  batchSize = 4000,
}: {
  events: TinybirdEvent[];
  batchSize?: number;
}): Promise<{ batches: number; rows: number }> {
  const apiUrl = process.env.TINYBIRDS_API_URL;
  const apiKey = process.env.TINYBIRDS_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error(
      "Analytics import is not configured on this server (missing Tinybird credentials)."
    );
  }

  if (events.length === 0) {
    return { batches: 0, rows: 0 };
  }

  let batches = 0;

  for (let i = 0; i < events.length; i += batchSize) {
    const chunk = events.slice(i, i + batchSize);
    const body = chunk.map((e) => JSON.stringify(e)).join("\n");

    let res: Response;
    try {
      res = await fetchWithRetry(`${apiUrl}/v0/events?name=dub_click_events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/x-ndjson",
        },
        body,
      });
    } catch (err) {
      throw new Error(
        `Failed to load batch ${batches + 1} into analytics after retries: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    if (!res.ok) {
      // Keep the surfaced message short — Tinybird error bodies can be large.
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(
        `Analytics rejected batch ${batches + 1} (HTTP ${res.status})${
          detail ? `: ${detail}` : ""
        }`
      );
    }

    batches++;
  }

  return { batches, rows: events.length };
}

// ── Rollback helper ─────────────────────────────────────────────────────────
// If an import needs to be undone (wrong file, duplicate run), delete rows
// tagged as imported for that workspace via Tinybird's Delete API.
//
// Rows must be removed from BOTH datasources: `dub_click_events` (the landing
// datasource the Events API writes to) and `dub_click_events_mv` (the
// materialized-view target that every analytics pipe actually reads). Deleting
// only the landing datasource leaves the imported traffic visible in the
// dashboard.
//
// NOTE: this deletes ALL plausible-imported rows for the workspace — there is
// no per-import-run id here. Add one (e.g. an `import_id` in event_properties)
// if you need to support multiple distinct imports per workspace safely.
export async function deletePlausibleImport({
  workspaceId,
}: {
  workspaceId: string;
}): Promise<void> {
  const apiUrl = process.env.TINYBIRDS_API_URL;
  const apiKey = process.env.TINYBIRDS_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error(
      "Analytics import is not configured on this server (missing Tinybird credentials)."
    );
  }

  const deleteCondition = `workspace_id = '${workspaceId.replace(
    /'/g,
    "''"
  )}' AND event_properties LIKE '%"_imported":"plausible"%'`;

  for (const datasource of ["dub_click_events_mv", "dub_click_events"]) {
    const res = await fetch(`${apiUrl}/v0/datasources/${datasource}/delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ delete_condition: deleteCondition }),
    });

    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(
        `Failed to remove imported rows from ${datasource} (HTTP ${res.status})${
          body ? `: ${body}` : ""
        }`
      );
    }
  }
}

// How many Plausible-imported rows the workspace currently has in analytics
// (reads dub_click_events_mv — the datasource every dashboard pipe queries).
// Used to drive the "Plausible connected / Disconnect" state on the import
// settings page. Returns 0 if Tinybird isn't configured rather than throwing,
// so the page still renders.
export async function countPlausibleImport({
  workspaceId,
}: {
  workspaceId: string;
}): Promise<number> {
  const apiUrl = process.env.TINYBIRDS_API_URL;
  const apiKey = process.env.TINYBIRDS_API_KEY;
  if (!apiUrl || !apiKey) return 0;

  const sql = `
    SELECT count() AS c
    FROM dub_click_events_mv
    WHERE workspace_id = '${workspaceId.replace(/'/g, "''")}'
      AND event_properties LIKE '%"_imported":"plausible"%'
    FORMAT JSON
  `;

  const res = await fetch(`${apiUrl}/v0/sql?q=${encodeURIComponent(sql)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(
      `Tinybird count failed (HTTP ${res.status}): ${(
        await res.text().catch(() => "")
      ).slice(0, 300)}`
    );
  }

  const body = await res.json().catch(() => null);
  const c = Number(body?.data?.[0]?.c);
  return Number.isFinite(c) ? c : 0;
}
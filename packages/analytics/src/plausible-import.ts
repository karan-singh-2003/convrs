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
// Converts a Plausible "export data" .zip into synthetic events matching the
// dub_click_events Tinybird schema, and bulk-loads them via Tinybird's
// Data Source Import API (NOT the streaming /v0/events endpoint — that one
// is tuned for live traffic, this one is tuned for backfills).
//
// MODELING NOTE (read this before trusting the numbers):
// Plausible's export is a set of independent daily marginal aggregates
// (pageviews by day, by page, by country, by device, by UTM param, ...).
// There is no visitor-level join key across files, so we can't reconstruct
// "this visitor was from France AND used Chrome" as one true event. What we
// *can* do is make each single-dimension breakdown numerically correct: for
// every row we synthesize exactly `visitors` distinct sessions dated to that
// day, with only that file's dimension populated (others "Unknown"), so
// COUNT(DISTINCT visitor_id) queries on that one dimension match Plausible.
//
// Where a row includes `bounces` and `visit_duration`, we go further and
// synthesize real multi-pageview sessions so bounce rate and average session
// duration are also approximately correct for that dimension slice:
//   - the first `bounces` of the row's sessions get exactly 1 pageview
//     (duration 0) — these correctly register as bounces downstream
//   - the remaining sessions get >= 2 pageviews, spread across a duration
//     budget derived from `visit_duration`, so the average comes out close
//   - rows without bounce/duration columns (exit pages, custom events) fall
//     back to one isolated pageview per visitor — there's nothing in the
//     source data to reconstruct a session from there.
// Cross-dimension filtering on imported data (country AND device together)
// is still not reliable — that's inherent to the source data, not a bug.
//
// FILE NAMING NOTE:
// Plausible's "export data" zip names files with a trailing date-range
// suffix, e.g. `imported_pages_20260731_20260804.csv`, not the bare
// `imported_pages.csv` you might expect. The matcher below accounts for
// both forms (and for the file living inside a subfolder in the zip).

import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { randomUUID, createHash } from "node:crypto";

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

function toClickHouseTimestamp(d: Date): string {
  return d.toISOString().replace("T", " ").replace("Z", "");
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

/**
 * Core session synthesizer. Given a row's visitor count, and optionally its
 * bounce count / total visit duration (seconds) / total pageviews, produces
 * one or more events per synthetic session so that:
 *   - COUNT(DISTINCT visitor_id) for this dimension slice == `visitors`
 *   - bounce rate downstream ~= bounces / visitors
 *   - avg session duration downstream ~= visitDurationSeconds (avg per visitor)
 */
function expandDimensionToSessions(params: {
  workspaceId: string;
  hostname: string;
  date: string;
  namespace: string; // e.g. "pages", "devices" — keeps ids unique per file
  dimensionKey: string; // e.g. the page path, device name, etc.
  visitors: number;
  bounces?: number; // if omitted, every session is treated as a bounce (1 pageview)
  visitDurationSeconds?: number; // Plausible reports this as an AVERAGE per visitor
  pageviews?: number; // total pageviews for the row, if known
  overrides?: Partial<TinybirdEvent>;
}): TinybirdEvent[] {
  const { workspaceId, hostname, date, namespace, dimensionKey, overrides } =
    params;

  const N = Math.max(0, Math.floor(params.visitors) || 0);
  if (N === 0) return [];

  const B = Math.min(Math.max(0, Math.floor(params.bounces ?? N) || 0), N);
  const nonBounced = N - B;

  // Total duration budget (seconds) across all non-bounced sessions.
  // Plausible's visit_duration is an average-per-visitor figure, so we
  // multiply back out to a total, then divide across just the non-bounced
  // sessions (bounced sessions always have 0 duration).
  const avgDurationPerVisitor = Math.max(0, params.visitDurationSeconds ?? 0);
  const totalDurationSeconds = avgDurationPerVisitor * N;
  const durationPerNonBouncedSession =
    nonBounced > 0 ? totalDurationSeconds / nonBounced : 0;

  // How many pageviews does each non-bounced session get? We need >= 2 per
  // session so it doesn't accidentally register as a bounce downstream.
  const rawPageviews = params.pageviews;
  const extraPageviews =
    rawPageviews !== undefined
      ? Math.max(0, Math.floor(rawPageviews) - N)
      : nonBounced; // no pageviews column available: assume 2 each as a reasonable default

  const events: TinybirdEvent[] = [];

  for (let i = 0; i < N; i++) {
    const visitorId = syntheticId(workspaceId, `${namespace}_v`, date, dimensionKey, i);
    const sessionId = syntheticId(workspaceId, `${namespace}_s`, date, dimensionKey, i);
    const sessionStart = randomTimeInDay(date);

    if (i < B) {
      // Bounced: exactly one pageview, zero duration.
      events.push(
        baseEvent({
          workspaceId,
          hostname,
          visitorId,
          sessionId,
          timestamp: sessionStart,
          overrides,
        })
      );
      continue;
    }

    // Non-bounced: figure out how many pageviews this specific session gets.
    const nonBouncedIndex = i - B; // 0-based index among non-bounced sessions
    let pvForSession: number;

    if (extraPageviews >= nonBounced) {
      // Enough extra pageviews to give everyone at least 2, distribute the
      // remainder round-robin.
      const leftover = extraPageviews - nonBounced;
      pvForSession =
        2 +
        Math.floor(leftover / nonBounced) +
        (nonBouncedIndex < leftover % nonBounced ? 1 : 0);
    } else {
      // Not enough extra pageviews for everyone to get 2 — give as many
      // sessions 2 pageviews as we can afford, the rest fall back to 1
      // (these will read as bounces downstream; only happens when the
      // source file's own numbers are internally inconsistent).
      pvForSession = nonBouncedIndex < extraPageviews ? 2 : 1;
    }

    for (let p = 0; p < pvForSession; p++) {
      const offsetSeconds =
        pvForSession > 1
          ? (durationPerNonBouncedSession * p) / (pvForSession - 1)
          : 0;
      const ts = new Date(sessionStart.getTime() + offsetSeconds * 1000);
      events.push(
        baseEvent({
          workspaceId,
          hostname,
          visitorId,
          sessionId,
          timestamp: ts,
          overrides,
        })
      );
    }
  }

  return events;
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
  return parse(text, { columns: true, skip_empty_lines: true, trim: true });
}

function num(row: Record<string, string>, key: string): number | undefined {
  const v = row[key];
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Pulls whichever UTM columns are non-empty on a row into event overrides.
// Current Plausible exports embed these directly in imported_sources.csv
// rather than shipping separate imported_utm_*.csv files, so this is what
// actually carries UTM data through for most real-world exports.
function utmOverridesFromRow(row: Record<string, string>): Partial<TinybirdEvent> {
  const overrides: Partial<TinybirdEvent> = {};
  if (row.utm_source) overrides.utm_source = row.utm_source;
  if (row.utm_medium) overrides.utm_medium = row.utm_medium;
  if (row.utm_campaign) overrides.utm_campaign = row.utm_campaign;
  if (row.utm_content) overrides.utm_content = row.utm_content;
  if (row.utm_term) overrides.utm_term = row.utm_term;
  return overrides;
}

export function parsePlausibleZip(
  zipBuffer: Buffer,
  { workspaceId, hostname }: { workspaceId: string; hostname: string }
): PlausibleImportResult {
  const zip = new AdmZip(zipBuffer);
  const events: TinybirdEvent[] = [];
  const filesParsed: string[] = [];
  const filesSkipped: string[] = [];

  for (const base of KNOWN_FILES) {
    const rows = readCsv(zip, base);
    if (rows === null) {
      filesSkipped.push(base);
      continue;
    }
    filesParsed.push(base);

    for (const row of rows) {
      const date = row.date;
      if (!date) continue;

      const visitors = num(row, "visitors") ?? 0;
      if (visitors <= 0) continue;

      switch (base) {
        case "imported_visitors": {
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "visitors",
              dimensionKey: "total",
              visitors,
              bounces: num(row, "bounces"),
              visitDurationSeconds: num(row, "visit_duration"),
              pageviews: num(row, "pageviews"),
            })
          );
          break;
        }

        case "imported_pages": {
          // Current exports include a `hostname` column for multi-domain
          // sites and never a `bounces` column — we keep attributing to the
          // workspace's configured domain and treat all sessions as
          // non-bounced, deriving extra pageviews from the row's own
          // `pageviews` count (same behavior as before).
          const page = row.page || "/";
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "pages",
              dimensionKey: page,
              visitors,
              bounces: 0,
              visitDurationSeconds: num(row, "visit_duration"),
              pageviews: num(row, "pageviews"),
              overrides: { page, url: `https://${hostname}${page}` },
            })
          );
          break;
        }

        case "imported_entry_pages": {
          const entrypage = row.entry_page || "/";
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "entry",
              dimensionKey: entrypage,
              visitors,
              bounces: num(row, "bounces"),
              visitDurationSeconds: num(row, "visit_duration"),
              pageviews: num(row, "pageviews"),
              overrides: {
                entrypage,
                page: entrypage,
                url: `https://${hostname}${entrypage}`,
              },
            })
          );
          break;
        }

        case "imported_exit_pages": {
          // No pageviews/session-shape columns available for exit pages —
          // single isolated pageview per visitor, as before.
          const exitlink = row.exit_page || "/";
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "exit",
              dimensionKey: exitlink,
              visitors,
              overrides: { exitlink },
            })
          );
          break;
        }

        case "imported_sources": {
          const source = row.source || "(direct)";
          const refererValue = source === "Direct / None" ? "(direct)" : source;
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "source",
              dimensionKey: source,
              visitors,
              bounces: num(row, "bounces"),
              visitDurationSeconds: num(row, "visit_duration"),
              pageviews: num(row, "pageviews"),
              overrides: {
                referer: refererValue,
                referer_url: refererValue,
                // Current exports carry UTM params as columns on this file
                // rather than in separate imported_utm_*.csv files.
                ...utmOverridesFromRow(row),
              },
            })
          );
          break;
        }

        case "imported_utm_sources": {
          const utmSource = row.utm_source || "";
          if (!utmSource) break;
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "utm_source",
              dimensionKey: utmSource,
              visitors,
              bounces: num(row, "bounces"),
              visitDurationSeconds: num(row, "visit_duration"),
              overrides: { utm_source: utmSource },
            })
          );
          break;
        }

        case "imported_utm_mediums": {
          const utmMedium = row.utm_medium || "";
          if (!utmMedium) break;
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "utm_medium",
              dimensionKey: utmMedium,
              visitors,
              bounces: num(row, "bounces"),
              visitDurationSeconds: num(row, "visit_duration"),
              overrides: { utm_medium: utmMedium },
            })
          );
          break;
        }

        case "imported_utm_campaigns": {
          const utmCampaign = row.utm_campaign || "";
          if (!utmCampaign) break;
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "utm_campaign",
              dimensionKey: utmCampaign,
              visitors,
              bounces: num(row, "bounces"),
              visitDurationSeconds: num(row, "visit_duration"),
              overrides: { utm_campaign: utmCampaign },
            })
          );
          break;
        }

        case "imported_utm_terms": {
          const utmTerm = row.utm_term || "";
          if (!utmTerm) break;
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "utm_term",
              dimensionKey: utmTerm,
              visitors,
              bounces: num(row, "bounces"),
              visitDurationSeconds: num(row, "visit_duration"),
              overrides: { utm_term: utmTerm },
            })
          );
          break;
        }

        case "imported_utm_contents": {
          const utmContent = row.utm_content || "";
          if (!utmContent) break;
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "utm_content",
              dimensionKey: utmContent,
              visitors,
              bounces: num(row, "bounces"),
              visitDurationSeconds: num(row, "visit_duration"),
              overrides: { utm_content: utmContent },
            })
          );
          break;
        }

        case "imported_locations": {
          // Current exports include bounces/visit_duration/pageviews here
          // too (older exports didn't) — use them when present for the same
          // session-shape fidelity as devices/browsers/etc., and fall back
          // to isolated pageviews when they're missing.
          const country = row.country || "Unknown";
          const region = row.region || "Unknown";
          const city = row.city || "Unknown";
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "geo",
              dimensionKey: `${country}|${region}|${city}`,
              visitors,
              bounces: num(row, "bounces"),
              visitDurationSeconds: num(row, "visit_duration"),
              pageviews: num(row, "pageviews"),
              overrides: { country, region, city },
            })
          );
          break;
        }

        case "imported_devices": {
          const device = row.device || "Unknown";
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "device",
              dimensionKey: device,
              visitors,
              bounces: num(row, "bounces"),
              visitDurationSeconds: num(row, "visit_duration"),
              pageviews: num(row, "pageviews"),
              overrides: { device },
            })
          );
          break;
        }

        case "imported_browsers": {
          const browser = row.browser || "Unknown";
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "browser",
              dimensionKey: browser,
              visitors,
              bounces: num(row, "bounces"),
              visitDurationSeconds: num(row, "visit_duration"),
              pageviews: num(row, "pageviews"),
              overrides: { browser, browser_version: row.browser_version || "Unknown" },
            })
          );
          break;
        }

        case "imported_operating_systems": {
          const os = row.operating_system || "Unknown";
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "os",
              dimensionKey: os,
              visitors,
              bounces: num(row, "bounces"),
              visitDurationSeconds: num(row, "visit_duration"),
              pageviews: num(row, "pageviews"),
              overrides: {
                os,
                os_version: row.operating_system_version || "Unknown",
              },
            })
          );
          break;
        }

        case "imported_custom_events": {
          // Goal completions — instantaneous events, no session concept.
          const eventName = row.name || "unknown_event";
          events.push(
            ...expandDimensionToSessions({
              workspaceId,
              hostname,
              date,
              namespace: "custom",
              dimensionKey: eventName,
              visitors,
              overrides: {
                event_type: "goals",
                event_name: eventName,
                trigger: "goal",
              },
            })
          );
          break;
        }
      }
    }
  }

  return { events, filesParsed, filesSkipped, rowCount: events.length };
}

// ── Bulk load into Tinybird ────────────────────────────────────────────────
// Uses the Data Source Import API (mode=append) rather than the streaming
// events endpoint — this is the correct tool for one-off historical
// backfills of thousands/millions of rows.
export async function loadEventsIntoTinybird({
  events,
  batchSize = 5000,
}: {
  events: TinybirdEvent[];
  batchSize?: number;
}): Promise<{ batches: number; rows: number }> {
  const apiUrl = process.env.TINYBIRDS_API_URL;
  const apiKey = process.env.TINYBIRDS_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error("Missing TINYBIRDS_API_URL / TINYBIRDS_API_KEY");
  }
  console.log({
    apiUrl,
    apiKey: apiKey.slice(0, 20) + "...",
  });
  let batches = 0;

  // for (let i = 0; i < events.length; i += batchSize) {
  //   const chunk = events.slice(i, i + batchSize);
  //   const ndjson = chunk.map((e) => JSON.stringify(e)).join("\n");

  //   const form = new FormData();
  //   form.append("mode", "append");
  //   form.append("name", "dub_click_events");
  //   form.append(
  //     "csv",
  //     new Blob([ndjson], { type: "application/x-ndjson" }),
  //     `plausible_import_${Date.now()}_${batches}.ndjson`
  //   );

  //   const res = await fetch(`${apiUrl}/v0/datasources`, {
  //     method: "POST",
  //     headers: { Authorization: `Bearer ${apiKey}` },
  //     body: form,
  //   });

  //   if (!res.ok) {
  //     const body = await res.text().catch(() => "");
  //     throw new Error(
  //       `Tinybird import failed (batch ${batches}, status ${res.status}): ${body}`
  //     );
  //   }

  //   batches++;
  // }
  for (let i = 0; i < events.length; i += batchSize) {
    const chunk = events.slice(i, i + batchSize);

    const body = chunk
      .map((e) => JSON.stringify(e))
      .join("\n");

    const res = await fetch(
      `${apiUrl}/v0/events?name=dub_click_events&wait=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/x-ndjson",
        },
        body,
      }
    );

    if (!res.ok) {
      throw new Error(await res.text());
    }
  }

  return { batches, rows: events.length };
}

// ── Rollback helper ─────────────────────────────────────────────────────────
// If an import needs to be undone (wrong file, duplicate run), delete rows
// tagged as imported for that workspace via Tinybird's Delete API.
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
    throw new Error("Missing TINYBIRDS_API_URL / TINYBIRDS_API_KEY");
  }

  const res = await fetch(
    `${apiUrl}/v0/datasources/dub_click_events/delete`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        delete_condition: `workspace_id = '${workspaceId.replace(
          /'/g,
          "''"
        )}' AND event_properties LIKE '%"_imported":"plausible"%'`,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tinybird delete failed (${res.status}): ${body}`);
  }
}
import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { parsePlausibleZip } from "@repo/analytics";

// Minimal ZIP writer (deflate entries) so this test doesn't need a zip
// dependency in apps/web. Produces an archive adm-zip (used inside
// parsePlausibleZip) reads back correctly.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function buildExportZip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, "utf-8");
    const data = Buffer.from(content, "utf-8");
    const compressed = deflateRawSync(data);
    const crc = crc32(data);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    locals.push(local, compressed);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    centrals.push(central);

    offset += local.length + compressed.length;
  }

  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(centrals.length, 8);
  eocd.writeUInt16LE(centrals.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralDir, eocd]);
}

const opts = { workspaceId: "ws_test", hostname: "example.com" };

describe("parsePlausibleZip", () => {
  it("parses a realistic multi-file export into synthetic events", () => {
    const zip = buildExportZip({
      "imported_visitors_20260101_20260102.csv":
        "date,visitors,pageviews,bounces,visits,visit_duration\n" +
        "2026-01-01,10,25,4,12,90\n" +
        "2026-01-02,6,10,6,6,0\n",
      "imported_pages_20260101_20260102.csv":
        "date,hostname,page,visits,visitors,pageviews,total_scroll_depth,total_scroll_depth_visits,total_time_on_page,total_time_on_page_visits\n" +
        "2026-01-01,example.com,/,8,8,15,0,0,0,0\n" +
        "2026-01-01,example.com,/pricing,3,3,5,0,0,0,0\n",
      "imported_sources_20260101_20260102.csv":
        "date,source,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,pageviews,visitors,visits,visit_duration,bounces\n" +
        "2026-01-01,Google,google.com,,,,,,12,6,7,120,2\n" +
        "2026-01-01,Twitter,t.co,twitter,social,launch,,,4,2,2,30,1\n",
      "imported_devices_20260101_20260102.csv":
        "date,device,visitors,visits,visit_duration,bounces,pageviews\n" +
        "2026-01-01,Desktop,7,8,100,3,14\n" +
        "2026-01-01,Mobile,3,3,20,2,4\n",
      "imported_custom_events_20260101_20260102.csv":
        "date,name,link_url,path,visitors,events\n" +
        "2026-01-01,Signup,,,4,5\n",
    });

    const result = parsePlausibleZip(zip, opts);
    const ev = result.events as Record<string, any>[];

    expect(result.filesParsed).toEqual(
      expect.arrayContaining([
        "imported_visitors",
        "imported_pages",
        "imported_sources",
        "imported_devices",
        "imported_custom_events",
      ])
    );
    expect(result.rowCount).toBe(ev.length);

    // Every synthesized event carries the dub_click_events columns and is
    // attributed to the workspace + hostname.
    for (const e of ev) {
      expect(e.workspace_id).toBe("ws_test");
      expect(e.hostname).toBe("example.com");
      expect(typeof e.event_id).toBe("string");
      expect(e.bot).toBe(0);
      // timestamp must be the ISO form the live path uses
      expect(e.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      // timestamp must fall on the CSV's own date, not "now"
      expect(["2026-01-01", "2026-01-02"]).toContain(
        String(e.timestamp).slice(0, 10)
      );
      expect(JSON.parse(e.event_properties as string)).toMatchObject({
        _imported: "plausible",
      });
    }

    // imported_visitors is the single source of truth for the visitor
    // population: 10 + 6 = 16 unique visitors, NOT the sum across every file.
    const pageviewEvents = ev.filter((e) => e.event_type === "pageview");
    const uniqVisitors = new Set(pageviewEvents.map((e) => e.visitor_id));
    expect(uniqVisitors.size).toBe(16);
    // sessions == visitors here (each visitor has one session)
    expect(new Set(pageviewEvents.map((e) => e.session_id)).size).toBe(16);

    // Breakdowns reflect the per-day dimension counts, capped at that day's
    // visitor total. Jan 1 has 10 visitors; devices say Desktop 7 / Mobile 3.
    const day1 = pageviewEvents.filter(
      (e) => String(e.timestamp).slice(0, 10) === "2026-01-01"
    );
    const deviceVisitors = (d: string) =>
      new Set(day1.filter((e) => e.device === d).map((e) => e.visitor_id)).size;
    expect(deviceVisitors("Desktop")).toBe(7);
    expect(deviceVisitors("Mobile")).toBe(3);

    const pageVisitors = (p: string) =>
      new Set(day1.filter((e) => e.page === p).map((e) => e.visitor_id)).size;
    expect(pageVisitors("/")).toBe(7);
    expect(pageVisitors("/pricing")).toBe(3);

    // bounce sessions (event_count === 1): Jan 1 has 4, Jan 2 has 6 → 10
    const perSession = new Map<string, number>();
    for (const e of pageviewEvents)
      perSession.set(e.session_id, (perSession.get(e.session_id) ?? 0) + 1);
    expect([...perSession.values()].filter((n) => n === 1).length).toBe(10);

    // `visit_duration` in imported_visitors is the day's TOTAL seconds, not a
    // per-visit average — the synthesized sessions must sum back to it (Jan 1:
    // 90s across 10 visits → avg 9s/visit, matching Plausible), NOT 90*10.
    const day1Span = (sessionId: string) => {
      const ts = day1
        .filter((e) => e.session_id === sessionId)
        .map((e) => new Date(e.timestamp as string).getTime());
      return (Math.max(...ts) - Math.min(...ts)) / 1000;
    };
    const day1Total = [...new Set(day1.map((e) => e.session_id))].reduce(
      (sum, sid) => sum + day1Span(sid),
      0
    );
    expect(day1Total).toBeCloseTo(90, 0);

    // UTM from imported_sources is carried onto the Twitter-sourced sessions.
    const utmEvents = ev.filter((e) => e.utm_source === "twitter");
    expect(utmEvents.length).toBeGreaterThan(0);
    expect(utmEvents[0].utm_campaign).toBe("launch");

    // Custom event -> goal events, one per fire (events=5), folded into the
    // day's real sessions (no new visitors invented).
    const goalEvents = ev.filter(
      (e) => e.event_type === "goals" && e.event_name === "Signup"
    );
    expect(goalEvents.length).toBe(5);
    for (const g of goalEvents) expect(uniqVisitors.has(g.visitor_id)).toBe(true);
  });

  it("drops Plausible's automatic 'engagement' pseudo-event", () => {
    const zip = buildExportZip({
      "imported_visitors_20260101_20260101.csv":
        "date,visitors,pageviews,bounces,visits,visit_duration\n" +
        "2026-01-01,5,5,5,5,0\n",
      "imported_custom_events_20260101_20260101.csv":
        "date,name,link_url,path,visitors,events\n" +
        "2026-01-01,engagement,,,5,40\n" +
        "2026-01-01,Signup,,,2,2\n",
    });
    const ev = parsePlausibleZip(zip, opts).events as Record<string, any>[];
    expect(ev.some((e) => e.event_name === "engagement")).toBe(false);
    expect(ev.filter((e) => e.event_name === "Signup").length).toBe(2);
    // 5 bounce sessions stay bounces — engagement didn't fold in and inflate them
    const perSession = new Map<string, number>();
    for (const e of ev.filter((x) => x.event_type === "pageview"))
      perSession.set(e.session_id, (perSession.get(e.session_id) ?? 0) + 1);
    expect([...perSession.values()].every((n) => n === 1)).toBe(true);
  });

  it("handles a UTF-8 BOM on the header row", () => {
    const zip = buildExportZip({
      "imported_visitors_20260101_20260101.csv":
        "﻿date,visitors,pageviews,bounces,visits,visit_duration\n" +
        "2026-01-01,5,10,2,5,60\n",
    });
    const result = parsePlausibleZip(zip, opts);
    expect(result.rowCount).toBeGreaterThan(0);
  });

  it("matches files with and without the date-range suffix", () => {
    const zip = buildExportZip({
      "imported_devices.csv":
        "date,device,visitors,visits,visit_duration,bounces,pageviews\n" +
        "2026-01-01,Desktop,3,3,30,1,6\n",
    });
    const result = parsePlausibleZip(zip, opts);
    expect(result.filesParsed).toContain("imported_devices");
    expect(result.rowCount).toBeGreaterThan(0);
  });

  it("does not confuse imported_sources with imported_utm_sources", () => {
    const zip = buildExportZip({
      "imported_utm_sources_20260101_20260101.csv":
        "date,utm_source,visitors,visits,visit_duration,bounces,pageviews\n" +
        "2026-01-01,newsletter,4,4,40,1,8\n",
    });
    const result = parsePlausibleZip(zip, opts);
    expect(result.filesParsed).toContain("imported_utm_sources");
    expect(result.filesParsed).not.toContain("imported_sources");
    const utmEvents = (result.events as Record<string, unknown>[]).filter(
      (e) => e.utm_source === "newsletter"
    );
    expect(utmEvents.length).toBeGreaterThan(0);
  });

  // ── Dashboard "Export to CSV" format ─────────────────────────────────────
  // The download-icon export on the Plausible dashboard: bare filenames, only
  // visitors.csv is dated, every other file is a period aggregate keyed by a
  // `name` column, no `bounces` column (only `bounce_rate`), geo/UA split
  // across several files.
  describe("dashboard Export to CSV format", () => {
    const dashZip = () =>
      buildExportZip({
        "visitors.csv":
          "date,visitors,pageviews,visits,views_per_visit,bounce_rate,visit_duration\n" +
          "2026-01-01,10,18,11,1.8,40,90\n" +
          "2026-01-02,6,6,6,1.0,100,\n",
        "pages.csv":
          "name,visitors,pageviews,bounce_rate,time_on_page,scroll_depth\n" +
          "/,12,20,50,30,80\n" +
          "/pricing,4,4,60,10,40\n",
        "sources.csv":
          "name,visitors,bounce_rate,visit_duration\n" +
          "Direct / None,10,50,40\n" +
          "X (Twitter),6,60,20\n",
        "countries.csv": "name,visitors\nUnited States,9\nIndia,7\n",
        "regions.csv": "name,visitors\nCalifornia,9\nPunjab,7\n",
        "cities.csv": "name,visitors\nSan Francisco,9\nLudhiāna,7\n",
        "devices.csv": "name,visitors\nDesktop,11\nMobile,5\n",
        "browsers.csv": "name,visitors\nChrome,12\nSafari,4\n",
        "operating_systems.csv": "name,visitors\nWindows,10\nMac,6\n",
        "entry_pages.csv":
          "name,unique_entrances,total_entrances,bounce_rate,visit_duration\n" +
          "/,16,17,55,45\n",
        "exit_pages.csv":
          "name,unique_exits,total_exits,exit_rate\n/,16,17,60.0\n",
        "channels.csv":
          "name,visitors,bounce_rate,visit_duration\nDirect,10,50,40\nOrganic Social,6,60,20\n",
        "conversions.csv":
          "name,unique_conversions,total_conversions\nSignup,3,4\nengagement,10,120\n",
        "utm_sources.csv":
          "name,visitors,bounce_rate,visit_duration\nnewsletter,5,20,50\n",
        "utm_mediums.csv":
          "name,visitors,bounce_rate,visit_duration\nemail,5,20,50\n",
      });

    it("parses the bare-filename dashboard export", () => {
      const result = parsePlausibleZip(dashZip(), opts);
      const ev = result.events as Record<string, any>[];
      expect(result.rowCount).toBeGreaterThan(0);
      expect(result.filesParsed).toEqual(
        expect.arrayContaining(["visitors", "pages", "sources", "countries"])
      );

      const pageviews = ev.filter((e) => e.event_type === "pageview");
      // visitors.csv is the population: 10 + 6 = 16 unique visitors
      expect(new Set(pageviews.map((e) => e.visitor_id)).size).toBe(16);

      for (const e of ev) {
        expect(e.workspace_id).toBe("ws_test");
        expect(e.hostname).toBe("example.com");
        expect(e.bot).toBe(0);
        expect(["2026-01-01", "2026-01-02"]).toContain(
          String(e.timestamp).slice(0, 10)
        );
        expect(JSON.parse(e.event_properties as string)).toMatchObject({
          _imported: "plausible",
        });
      }
    });

    it("populates country/device/browser/page/referer breakdowns", () => {
      const ev = (parsePlausibleZip(dashZip(), opts).events as Record<
        string,
        any
      >[]).filter((e) => e.event_type === "pageview");

      const uniqBy = (field: string, val: string) =>
        new Set(
          ev.filter((e) => e[field] === val).map((e) => e.visitor_id)
        ).size;

      // country display names are mapped back to ISO-2 codes
      expect(uniqBy("country", "US")).toBe(9);
      expect(uniqBy("country", "IN")).toBe(7);
      expect(uniqBy("device", "Desktop")).toBe(11);
      expect(uniqBy("device", "Mobile")).toBe(5);
      expect(uniqBy("browser", "Chrome")).toBe(12);
      expect(uniqBy("page", "/pricing")).toBe(4);
      // "Direct / None" normalises to (direct); "X (Twitter)" → twitter.com
      expect(uniqBy("referer", "twitter.com")).toBe(6);
      expect(uniqBy("referer", "(direct)")).toBe(10);
      // no synthetic pageview left with an unpopulated dimension
      expect(ev.every((e) => e.country !== "Unknown")).toBe(true);
      expect(ev.every((e) => e.device !== "Unknown")).toBe(true);

      // UTM is carried both on the column and folded into the url query string
      // (the UTM/campaign breakdowns read it out of the url, not the column)
      const utm = ev.filter((e) => e.utm_source === "newsletter");
      expect(new Set(utm.map((e) => e.visitor_id)).size).toBe(5);
      expect(
        utm.every((e) => String(e.url).includes("utm_source=newsletter"))
      ).toBe(true);
      expect(utm.every((e) => String(e.url).includes("utm_medium=email"))).toBe(
        true
      );
    });

    it("derives bounces from bounce_rate and folds conversions into sessions", () => {
      const ev = parsePlausibleZip(dashZip(), opts).events as Record<
        string,
        any
      >[];
      const pageviews = ev.filter((e) => e.event_type === "pageview");

      // Jan 1: 40% of 10 → 4 bounces; Jan 2: 100% of 6 → 6 bounces → 10 total
      const perSession = new Map<string, number>();
      for (const e of pageviews)
        perSession.set(e.session_id, (perSession.get(e.session_id) ?? 0) + 1);
      expect([...perSession.values()].filter((n) => n === 1).length).toBe(10);

      // conversions.csv: Signup fires 4 times, engagement dropped
      const goals = ev.filter((e) => e.event_type === "goals");
      expect(goals.every((g) => g.event_name === "Signup")).toBe(true);
      expect(goals.length).toBe(4);
      const visitors = new Set(pageviews.map((e) => e.visitor_id));
      for (const g of goals) expect(visitors.has(g.visitor_id)).toBe(true);
    });

    it("is not mistaken for the native import format", () => {
      // a zip with imported_visitors.csv must still take the native path
      const zip = buildExportZip({
        "imported_visitors_20260101_20260101.csv":
          "date,visitors,pageviews,bounces,visits,visit_duration\n" +
          "2026-01-01,5,5,5,5,0\n",
        "visitors.csv":
          "date,visitors,pageviews,visits,views_per_visit,bounce_rate,visit_duration\n" +
          "2026-01-01,999,999,999,1,0,0\n",
      });
      const result = parsePlausibleZip(zip, opts);
      const uniq = new Set(
        (result.events as Record<string, any>[]).map((e) => e.visitor_id)
      );
      expect(uniq.size).toBe(5); // from imported_visitors, not visitors.csv
    });
  });

  it("throws a clear error on a non-zip payload", () => {
    expect(() =>
      parsePlausibleZip(Buffer.from("not a zip file"), opts)
    ).toThrow(/zip archive/i);
  });

  it("reports zero rows (not a crash) for an unrelated zip", () => {
    const zip = buildExportZip({ "readme.txt": "hello" });
    const result = parsePlausibleZip(zip, opts);
    expect(result.rowCount).toBe(0);
    expect(result.filesParsed).toHaveLength(0);
  });
});

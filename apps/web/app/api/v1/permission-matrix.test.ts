/**
 * Table-driven authorization audit: every /api/v1 endpoint × every
 * single-scope token, asserting the scope GATE specifically (does
 * withApiToken let the request reach the handler at all), not full
 * endpoint business-logic correctness — that's covered by each endpoint's
 * own dedicated test file.
 *
 * For "wrong scope"/"no scope" cases we assert exactly 403. For "correct
 * scope" cases we assert the response is NOT 403 (i.e. the scope gate
 * passed) — it may still be 200 or a non-403 error from unmocked internals,
 * which is fine here since only the gate itself is under test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { Scope } from "@/lib/api/tokens/scopes";

vi.mock("@repo/db", () => ({
  prisma: {
    restrictedToken: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    workspace: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth/hash-token", () => ({
  hashToken: vi.fn(async (t: string) => `hashed:${t}`),
}));
vi.mock("@/lib/api/v1/rate-limit", () => ({
  checkApiRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 60, remaining: 59, retryAfter: 0 }),
}));

// One mock per distinct service each route touches, so reaching the handler
// (once the scope gate passes) never makes a real network/Tinybird call.
vi.mock("@/lib/analytics/get-analytics", () => ({ getAnalytics: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/analytics/live-visitors", () => ({
  getLiveStats: vi.fn().mockResolvedValue({ count: 0, pages: [], points: [], referrers: [], countries: [] }),
}));
vi.mock("@/lib/analytics/get-bot-analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics/get-bot-analytics")>();
  return { ...actual, getBotFilteringAnalytics: vi.fn().mockResolvedValue(null) };
});
vi.mock("@/lib/api/goals/query-goals", () => ({
  listWorkspaceGoals: vi.fn().mockResolvedValue({ rows: [], hasMore: false }),
}));
vi.mock("@/lib/analytics/get-goal-timeseries", () => ({
  getGoalsTimeseries: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/api/customers/query-customers", () => ({
  listWorkspaceCustomers: vi.fn().mockResolvedValue([]),
  getWorkspaceCustomerById: vi.fn().mockResolvedValue({ id: "cust_1" }),
}));
vi.mock("@/lib/analytics/get-customer-activity", () => ({
  getCustomerActivity: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/api/payments/query-payments", () => ({
  listWorkspacePayments: vi.fn().mockResolvedValue({ rows: [], hasMore: false }),
}));
vi.mock("@/lib/api/funnels/query-funnels", () => ({
  listWorkspaceFunnels: vi.fn().mockResolvedValue({ rows: [], hasMore: false }),
  getWorkspaceFunnelById: vi.fn().mockResolvedValue({ id: "f_1", steps: [] }),
}));
vi.mock("@/lib/analytics/get-funnel-analytics", () => ({
  getFunnelAnalytics: vi.fn().mockResolvedValue([]),
}));

import { prisma } from "@repo/db";

import { GET as accountGET } from "./account/route";
import { GET as websitesGET } from "./websites/route";
import { GET as websiteGET } from "./websites/[websiteId]/route";
import { GET as analyticsGET } from "./analytics/route";
import { GET as timeseriesGET } from "./analytics/timeseries/route";
import { GET as pagesGET } from "./analytics/pages/route";
import { GET as sourcesGET } from "./analytics/sources/route";
import { GET as geoGET } from "./analytics/geo/route";
import { GET as devicesGET } from "./analytics/devices/route";
import { GET as revenueGET } from "./analytics/revenue/route";
import { GET as realtimeGET } from "./analytics/realtime/route";
import { GET as botsGET } from "./analytics/bots/route";
import { GET as analyticsGoalsGET } from "./analytics/goals/route";
import { GET as goalsGET } from "./goals/route";
import { GET as goalPropertiesGET } from "./analytics/goals/properties/route";
import { GET as customersGET } from "./customers/route";
import { GET as customerGET } from "./customers/[customerId]/route";
import { GET as customerActivityGET } from "./customers/[customerId]/activity/route";
import { GET as paymentsGET } from "./payments/route";
import { GET as funnelsGET } from "./funnels/route";
import { GET as funnelGET } from "./funnels/[funnelId]/route";
import { GET as funnelAnalyticsGET } from "./analytics/funnels/[funnelId]/route";
import { GET as metaGET } from "./meta/route";

type Handler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> }
) => Promise<Response>;

const params = (p: Record<string, string> = {}) => ({ params: Promise.resolve(p) });

interface EndpointCase {
  name: string;
  handler: Handler;
  url: string;
  params?: Record<string, string>;
  requiredScope: Scope | null; // null = any valid token, no scope required
}

const ENDPOINTS: EndpointCase[] = [
  { name: "GET /account", handler: accountGET, url: "http://localhost/api/v1/account", requiredScope: null },
  { name: "GET /websites", handler: websitesGET, url: "http://localhost/api/v1/websites", requiredScope: "websites.read" },
  // "ws_1" (prefixed) is the *display* form of the raw workspace id "1" used
  // in mockToken() below — checkWebsiteScope() strips the "ws_" prefix
  // before comparing, so the param must be the prefixed form to match.
  { name: "GET /websites/:id", handler: websiteGET, url: "http://localhost/api/v1/websites/ws_1", params: { websiteId: "ws_1" }, requiredScope: "websites.read" },
  { name: "GET /analytics", handler: analyticsGET, url: "http://localhost/api/v1/analytics", requiredScope: "analytics.read" },
  { name: "GET /analytics/timeseries", handler: timeseriesGET, url: "http://localhost/api/v1/analytics/timeseries", requiredScope: "analytics.read" },
  { name: "GET /analytics/pages", handler: pagesGET, url: "http://localhost/api/v1/analytics/pages", requiredScope: "analytics.read" },
  { name: "GET /analytics/sources", handler: sourcesGET, url: "http://localhost/api/v1/analytics/sources", requiredScope: "analytics.read" },
  { name: "GET /analytics/geo", handler: geoGET, url: "http://localhost/api/v1/analytics/geo", requiredScope: "analytics.read" },
  { name: "GET /analytics/devices", handler: devicesGET, url: "http://localhost/api/v1/analytics/devices", requiredScope: "analytics.read" },
  { name: "GET /analytics/revenue", handler: revenueGET, url: "http://localhost/api/v1/analytics/revenue", requiredScope: "analytics.read" },
  { name: "GET /analytics/realtime", handler: realtimeGET, url: "http://localhost/api/v1/analytics/realtime", requiredScope: "analytics.read" },
  { name: "GET /analytics/bots", handler: botsGET, url: "http://localhost/api/v1/analytics/bots", requiredScope: "analytics.read" },
  { name: "GET /analytics/goals", handler: analyticsGoalsGET, url: "http://localhost/api/v1/analytics/goals", requiredScope: "goals.read" },
  { name: "GET /goals", handler: goalsGET, url: "http://localhost/api/v1/goals", requiredScope: "goals.read" },
  { name: "GET /analytics/goals/properties", handler: goalPropertiesGET, url: "http://localhost/api/v1/analytics/goals/properties", requiredScope: "goals.read" },
  { name: "GET /customers", handler: customersGET, url: "http://localhost/api/v1/customers", requiredScope: "analytics.read" },
  { name: "GET /customers/:id", handler: customerGET, url: "http://localhost/api/v1/customers/cust_1", params: { customerId: "cust_1" }, requiredScope: "analytics.read" },
  { name: "GET /customers/:id/activity", handler: customerActivityGET, url: "http://localhost/api/v1/customers/cust_1/activity", params: { customerId: "cust_1" }, requiredScope: "analytics.read" },
  { name: "GET /payments", handler: paymentsGET, url: "http://localhost/api/v1/payments", requiredScope: "payments.read" },
  { name: "GET /funnels", handler: funnelsGET, url: "http://localhost/api/v1/funnels", requiredScope: "analytics.read" },
  { name: "GET /funnels/:id", handler: funnelGET, url: "http://localhost/api/v1/funnels/f_1", params: { funnelId: "f_1" }, requiredScope: "analytics.read" },
  { name: "GET /analytics/funnels/:id", handler: funnelAnalyticsGET, url: "http://localhost/api/v1/analytics/funnels/f_1", params: { funnelId: "f_1" }, requiredScope: "analytics.read" },
  { name: "GET /meta", handler: metaGET, url: "http://localhost/api/v1/meta", requiredScope: null },
];

const ALL_SCOPES: Scope[] = ["analytics.read", "goals.read", "payments.read", "websites.read"];

function mockToken(scopes: string) {
  (prisma.restrictedToken.findUnique as any).mockResolvedValue({
    id: "tok_1",
    name: "t",
    scopes,
    expires: null,
    workspaceId: "1",
  });
  (prisma.workspace.findUnique as any).mockResolvedValue({
    id: "1",
    timezone: "UTC",
    currency: "USD",
    kpiType: "revenue",
    kpiEventName: null,
    projectToken: "pt_1",
  });
}

async function call(endpoint: EndpointCase, scopes: string) {
  mockToken(scopes);
  const req = new NextRequest(endpoint.url, {
    headers: { authorization: "Bearer cvrs_valid" },
  });
  return endpoint.handler(req, params(endpoint.params));
}

describe("permission matrix: correct scope is allowed through the gate", () => {
  beforeEach(() => vi.clearAllMocks());

  for (const endpoint of ENDPOINTS) {
    const label = endpoint.requiredScope ?? "any valid token (no scope required)";
    it(`${endpoint.name} — ${label} — not rejected for scope`, async () => {
      const scopes = endpoint.requiredScope ? endpoint.requiredScope : "";
      const res = await call(endpoint, scopes);
      expect(res.status).not.toBe(403);
    });
  }
});

describe("permission matrix: wrong single scope is rejected", () => {
  beforeEach(() => vi.clearAllMocks());

  for (const endpoint of ENDPOINTS) {
    if (!endpoint.requiredScope) continue; // /account and /meta: no wrong scope to test

    const wrongScopes = ALL_SCOPES.filter((s) => s !== endpoint.requiredScope);
    for (const wrongScope of wrongScopes) {
      it(`${endpoint.name} — requires ${endpoint.requiredScope} — rejects ${wrongScope}`, async () => {
        const res = await call(endpoint, wrongScope);
        expect(res.status).toBe(403);
      });
    }
  }
});

describe("permission matrix: no scope at all is rejected (except /account and /meta)", () => {
  beforeEach(() => vi.clearAllMocks());

  for (const endpoint of ENDPOINTS) {
    if (!endpoint.requiredScope) continue;

    it(`${endpoint.name} — no scopes — 403`, async () => {
      const res = await call(endpoint, "");
      expect(res.status).toBe(403);
    });
  }
});

describe("permission matrix: dead scopes (workspace.*, webhooks.*) unlock nothing", () => {
  beforeEach(() => vi.clearAllMocks());

  const deadScopes = ["workspace.read", "workspace.write", "webhooks.read", "webhooks.write"];

  for (const scope of deadScopes) {
    for (const endpoint of ENDPOINTS.filter((e) => e.requiredScope !== null)) {
      it(`${endpoint.name} — ${scope} alone — 403 (not a substitute for a real resource scope)`, async () => {
        const res = await call(endpoint, scope);
        expect(res.status).toBe(403);
      });
    }

    for (const endpoint of ENDPOINTS.filter((e) => e.requiredScope === null)) {
      it(`${endpoint.name} — ${scope} alone — still works (any valid token)`, async () => {
        const res = await call(endpoint, scope);
        expect(res.status).not.toBe(403);
      });
    }
  }
});

describe("permission matrix: apis.all and apis.read presets", () => {
  beforeEach(() => vi.clearAllMocks());

  for (const endpoint of ENDPOINTS) {
    it(`${endpoint.name} — apis.all — always allowed`, async () => {
      const res = await call(endpoint, "apis.all");
      expect(res.status).not.toBe(403);
    });

    it(`${endpoint.name} — apis.read — allowed (every required scope here ends in .read)`, async () => {
      const res = await call(endpoint, "apis.read");
      expect(res.status).not.toBe(403);
    });
  }
});

describe("permission matrix: multiple scopes are additive, not exclusive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a token with analytics.read + goals.read + payments.read can reach all three resource groups but not websites", async () => {
    const scopes = "analytics.read goals.read payments.read";

    const analyticsRes = await call(ENDPOINTS.find((e) => e.name === "GET /analytics")!, scopes);
    expect(analyticsRes.status).not.toBe(403);

    const goalsRes = await call(ENDPOINTS.find((e) => e.name === "GET /goals")!, scopes);
    expect(goalsRes.status).not.toBe(403);

    const paymentsRes = await call(ENDPOINTS.find((e) => e.name === "GET /payments")!, scopes);
    expect(paymentsRes.status).not.toBe(403);

    const websitesRes = await call(ENDPOINTS.find((e) => e.name === "GET /websites")!, scopes);
    expect(websitesRes.status).toBe(403);
  });
});

describe("permission matrix: openapi.json is public (not part of the scope matrix)", () => {
  it("requires no Authorization header at all", async () => {
    const { GET } = await import("./openapi.json/route");
    const res = GET();
    expect(res.status).toBe(200);
  });
});

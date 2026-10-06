import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/db", () => ({
  prisma: { workspace: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/analytics/live-visitors", () => ({ recordHeartbeat: vi.fn() }));

import { prisma } from "@repo/db";
import { recordHeartbeat } from "@/lib/analytics/live-visitors";
import { POST } from "./route";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let tokenSeq = 0;
const freshToken = () => `tok_${++tokenSeq}_${Date.now()}`;

function beat(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/live/heartbeat", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": CHROME, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: freshToken(),
    visitorId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    sessionId: "f1e2d3c4-b5a6-4978-8695-a4b3c2d1e0f9",
    page: "/pricing",
    url: "https://example.com/pricing",
    ...overrides,
  };
}

const ACTIVE = {
  domain: "example.com",
  allowedHostnames: [],
  allowAllDomains: false,
  subscriptionStatus: "active",
  freeTrialEndDate: null,
  paymentFailedAt: null,
};

describe("POST /api/live/heartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.workspace.findUnique as any).mockResolvedValue(ACTIVE);
    (recordHeartbeat as any).mockResolvedValue(undefined);
  });

  it("records a valid heartbeat from the workspace's own site", async () => {
    const res = await POST(beat(payload(), { origin: "https://example.com" }));
    expect(res.status).toBe(200);
    expect(recordHeartbeat).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown project tokens", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(null);
    const res = await POST(beat(payload()));
    expect(res.status).toBe(404);
    expect(recordHeartbeat).not.toHaveBeenCalled();
  });

  it("rejects heartbeats for hosts the workspace does not own", async () => {
    const res = await POST(beat(payload({ url: "https://evil.com/x" })));
    expect(res.status).toBe(403);
    expect(recordHeartbeat).not.toHaveBeenCalled();
  });

  it("rejects an Origin that does not match the reported page", async () => {
    const res = await POST(beat(payload(), { origin: "https://evil.com" }));
    expect(res.status).toBe(403);
    expect(recordHeartbeat).not.toHaveBeenCalled();
  });

  it("rejects workspaces without an active subscription or trial", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue({ ...ACTIVE, subscriptionStatus: "canceled" });
    const res = await POST(beat(payload()));
    expect(res.status).toBe(402);
    expect(recordHeartbeat).not.toHaveBeenCalled();
  });

  it("ignores crawlers without recording them as live visitors", async () => {
    const res = await POST(
      beat(payload(), { "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)" })
    );
    expect(res.status).toBe(202);
    expect(recordHeartbeat).not.toHaveBeenCalled();
  });

  it.each([
    ["non-path page", { page: "javascript:alert(1)" }],
    ["visitorId with separator characters", { visitorId: "abc|/evil|1|2" }],
    ["non-URL url", { url: "not a url" }],
    ["oversized workspaceId", { workspaceId: "x".repeat(200) }],
  ])("rejects a %s", async (_label, overrides) => {
    const res = await POST(beat(payload(overrides)));
    expect(res.status).toBe(400);
    expect(recordHeartbeat).not.toHaveBeenCalled();
  });

  it("rejects oversized and malformed bodies", async () => {
    expect((await POST(beat("x".repeat(5000)))).status).toBe(413);
    expect((await POST(beat("{not json"))).status).toBe(400);
  });

  it("caches the workspace lookup across heartbeats for the same token", async () => {
    const body = payload();
    await POST(beat(body));
    await POST(beat(body));
    await POST(beat(body));
    expect(prisma.workspace.findUnique).toHaveBeenCalledTimes(1);
    expect(recordHeartbeat).toHaveBeenCalledTimes(3);
  });

  it("does not trust client-sent Vercel geo headers off Vercel", async () => {
    await POST(beat(payload(), { "x-vercel-ip-country": "FR", "x-vercel-ip-latitude": "1" }));
    const call = (recordHeartbeat as any).mock.calls[0][0];
    expect(call.country).toBeUndefined();
    expect(call.latitude).toBeUndefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let incoming = new Headers();
vi.mock("next/headers", () => ({ headers: async () => incoming }));

const fetchMock = vi.fn();
const SECRET = "test-forward-secret-value";

async function loadRoute() {
  vi.resetModules(); // fresh "missing secret logged" state per test
  return import("./route");
}

async function forward(requestHeaders: Record<string, string>) {
  incoming = new Headers(requestHeaders);
  const { POST } = await loadRoute();
  const res = await POST(new Request("https://convrs.dev/api/track", { method: "POST", body: "{}" }));
  const [, init] = fetchMock.mock.calls.at(-1)!;
  return { res, sent: init.headers as Record<string, string> };
}

// What Vercel's edge sets for a visitor at 203.0.113.9 in Berlin.
const vercelRequest = {
  "user-agent": "Mozilla/5.0 Chrome/129.0",
  origin: "https://example.com",
  "x-vercel-forwarded-for": "203.0.113.9",
  "x-real-ip": "203.0.113.9",
  "x-vercel-ip-country": "DE",
  "x-vercel-ip-country-region": "BE",
  "x-vercel-ip-city": "Berlin",
  "x-vercel-ip-continent": "EU",
  "x-vercel-ip-latitude": "52.52",
  "x-vercel-ip-longitude": "13.40",
};

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async () => new Response('{"success":true}', { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("INGEST_FORWARD_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/track forwarding to ingestion", () => {
  it("sends the signed client IP and geo", async () => {
    const { res, sent } = await forward(vercelRequest);
    expect(res.status).toBe(200);
    expect(sent).toMatchObject({
      "x-convrs-forward-secret": SECRET,
      "x-convrs-client-ip": "203.0.113.9",
      "x-convrs-geo-country": "DE",
      "x-convrs-geo-region": "BE",
      "x-convrs-geo-city": "Berlin",
      "x-convrs-geo-continent": "EU",
      "x-convrs-geo-latitude": "52.52",
      "x-convrs-geo-longitude": "13.40",
      origin: "https://example.com",
      "user-agent": "Mozilla/5.0 Chrome/129.0",
    });
  });

  it("also sends the legacy x-forwarded-for / x-vercel-ip-* headers during the rollout window", async () => {
    const { sent } = await forward(vercelRequest);
    expect(sent).toMatchObject({
      "x-forwarded-for": "203.0.113.9",
      "x-vercel-ip-country": "DE",
      "x-vercel-ip-country-region": "BE",
      "x-vercel-ip-city": "Berlin",
      "x-vercel-ip-continent": "EU",
      "x-vercel-ip-latitude": "52.52",
      "x-vercel-ip-longitude": "13.40",
    });
  });

  it("client-sent forwarding headers never override the Vercel-derived values", async () => {
    const { sent } = await forward({
      ...vercelRequest,
      "x-forwarded-for": "6.6.6.6, 203.0.113.9",
      "x-convrs-client-ip": "6.6.6.6",
      "x-convrs-forward-secret": "attacker-secret",
      "x-convrs-geo-country": "KP",
      "x-debug-ip": "6.6.6.6",
    });
    expect(sent["x-forwarded-for"]).toBe("203.0.113.9");
    expect(sent["x-convrs-client-ip"]).toBe("203.0.113.9");
    expect(sent["x-convrs-forward-secret"]).toBe(SECRET);
    expect(sent["x-convrs-geo-country"]).toBe("DE");
    expect(sent).not.toHaveProperty("x-debug-ip");
    expect(Object.values(sent)).not.toContain("6.6.6.6");
  });

  it("off Vercel, no visitor IP/geo is forwarded at all, signed or legacy", async () => {
    vi.stubEnv("VERCEL", "");
    const { sent } = await forward({ ...vercelRequest, "x-forwarded-for": "6.6.6.6" });
    expect(Object.keys(sent).sort()).toEqual(["content-type", "origin", "user-agent"]);
  });

  it("missing secret on Vercel: logs one error without the secret, still forwards legacy headers, and responds normally", async () => {
    vi.stubEnv("INGEST_FORWARD_SECRET", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    incoming = new Headers(vercelRequest);
    const { POST } = await loadRoute();
    const call = () => POST(new Request("https://convrs.dev/api/track", { method: "POST", body: "{}" }));
    const first = await call();
    await call();

    expect(first.status).toBe(200);
    expect(await first.text()).toBe('{"success":true}');
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]![0])).toMatch(/INGEST_FORWARD_SECRET is not set/);

    const sent = fetchMock.mock.calls.at(-1)![1].headers as Record<string, string>;
    expect(sent).not.toHaveProperty("x-convrs-forward-secret");
    expect(sent).not.toHaveProperty("x-convrs-client-ip");
    expect(sent["x-forwarded-for"]).toBe("203.0.113.9");
  });

  it("does not log the missing-secret error off Vercel (local development)", async () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("INGEST_FORWARD_SECRET", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await forward(vercelRequest);
    expect(error).not.toHaveBeenCalled();
  });

  it("the secret never appears in the response", async () => {
    const { res } = await forward(vercelRequest);
    expect(await res.text()).not.toContain(SECRET);
    expect([...res.headers.values()].join(" ")).not.toContain(SECRET);
  });
});

import { test, expect } from "@playwright/test";
import { prisma } from "../fixtures/db";
import { createTrackingWorkspace, randomToken } from "../fixtures/seed";
import { buildPageviewPayload, REAL_CHROME_UA } from "../fixtures/track";
import { INGEST_BASE_URL, INGEST_FORWARD_SECRET } from "../fixtures/env";

async function usageFor(workspaceId: string): Promise<number> {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { usage: true } });
  return ws.usage;
}

const customersFor = (workspaceId: string) => prisma.customer.count({ where: { workspaceId } });

test.describe("hostname / project isolation on POST /api/track", () => {
  test("a copied project token cannot report pages from another site", async ({ request }) => {
    const ws = await createTrackingWorkspace("iso-foreign-host");

    const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: { "user-agent": REAL_CHROME_UA },
      data: { ...buildPageviewPayload({ websiteId: ws.projectToken! }), href: "https://evil.com/landing" },
    });

    expect(response.status()).toBe(403);
    expect((await response.json()).code).toBe("hostname_not_allowed");
    expect(await usageFor(ws.id)).toBe(0);
    expect(await customersFor(ws.id)).toBe(0);
  });

  test("data-domain cannot make a foreign page look like the configured domain", async ({ request }) => {
    const ws = await createTrackingWorkspace("iso-data-domain");

    const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: { "user-agent": REAL_CHROME_UA },
      data: {
        ...buildPageviewPayload({ websiteId: ws.projectToken! }),
        href: "https://evil.com/landing",
        domain: "example.com", // what data-domain sends
        hostname: "example.com",
      },
    });

    expect(response.status()).toBe(403);
    expect(await usageFor(ws.id)).toBe(0);
  });

  test("a browser Origin that differs from the reported page is rejected", async ({ request }) => {
    const ws = await createTrackingWorkspace("iso-origin");

    const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: { "user-agent": REAL_CHROME_UA, origin: "https://evil.com" },
      data: buildPageviewPayload({ websiteId: ws.projectToken! }), // href is example.com
    });

    expect(response.status()).toBe(403);
    expect((await response.json()).code).toBe("origin_mismatch");
    expect(await usageFor(ws.id)).toBe(0);
  });

  test("subdomains, allowedHostnames and allowAllDomains are accepted", async ({ request }) => {
    const ws = await createTrackingWorkspace("iso-allowed");
    await prisma.workspace.update({ where: { id: ws.id }, data: { allowedHostnames: ["shop.partner.io"] } });

    for (const href of ["https://blog.example.com/a", "https://shop.partner.io/b"]) {
      const response = await request.post(`${INGEST_BASE_URL}/api/track`, {
        headers: { "user-agent": REAL_CHROME_UA, origin: new URL(href).origin },
        data: { ...buildPageviewPayload({ websiteId: ws.projectToken! }), href },
      });
      expect(response.status(), href).toBe(200);
    }

    await prisma.workspace.update({ where: { id: ws.id }, data: { allowAllDomains: true } });
    const anyHost = await request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: { "user-agent": REAL_CHROME_UA },
      data: { ...buildPageviewPayload({ websiteId: ws.projectToken! }), href: "https://other.net/" },
    });
    expect(anyHost.status()).toBe(200);
    expect(await usageFor(ws.id)).toBe(3);
  });
});

test.describe("anonymous Customer creation", () => {
  test("concurrent first pageviews for one visitor create exactly one Customer and all succeed", async ({
    request,
  }) => {
    const ws = await createTrackingWorkspace("iso-customer-race");
    const visitorId = randomToken("vid");

    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        request.post(`${INGEST_BASE_URL}/api/track`, {
          headers: { "user-agent": REAL_CHROME_UA },
          data: { ...buildPageviewPayload({ websiteId: ws.projectToken! }), visitorId },
        })
      )
    );

    for (const response of responses) expect(response.status()).toBe(200);
    expect(await prisma.customer.count({ where: { workspaceId: ws.id, externalId: visitorId } })).toBe(1);
    expect(await usageFor(ws.id)).toBe(6);
  });
});

test.describe("cookieless visitor identity uses the trusted client IP", () => {
  function cookieless(request: import("@playwright/test").APIRequestContext, websiteId: string, clientIp: string) {
    return request.post(`${INGEST_BASE_URL}/api/track`, {
      headers: {
        "user-agent": REAL_CHROME_UA,
        "x-convrs-forward-secret": INGEST_FORWARD_SECRET,
        "x-convrs-client-ip": clientIp,
      },
      data: buildPageviewPayload({ websiteId, cookieless: true }),
    });
  }

  test("same visitor → same ID; different visitor IP → different ID; forged headers change nothing", async ({
    request,
  }) => {
    const ws = await createTrackingWorkspace("iso-cookieless");

    const a1 = await (await cookieless(request, ws.projectToken!, "203.0.113.10")).json();
    const a2 = await (await cookieless(request, ws.projectToken!, "203.0.113.10")).json();
    const b = await (await cookieless(request, ws.projectToken!, "203.0.113.11")).json();

    expect(a1.visitorId).toMatch(/^[0-9a-f]{64}$/);
    expect(a2.visitorId).toBe(a1.visitorId);
    expect(b.visitorId).not.toBe(a1.visitorId);

    // Without the forward secret, a client-supplied IP header is ignored, so
    // two "different" forged IPs from the same socket hash identically.
    const forged = (ip: string) =>
      request.post(`${INGEST_BASE_URL}/api/track`, {
        headers: { "user-agent": REAL_CHROME_UA, "x-forwarded-for": ip, "x-convrs-client-ip": ip },
        data: buildPageviewPayload({ websiteId: ws.projectToken!, cookieless: true }),
      });
    const f1 = await (await forged("198.51.100.1")).json();
    const f2 = await (await forged("198.51.100.2")).json();
    expect(f1.visitorId).toBe(f2.visitorId);
  });
});

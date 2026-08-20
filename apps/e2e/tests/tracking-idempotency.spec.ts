import { test, expect } from "@playwright/test";
import { prisma } from "../fixtures/db";
import { createTrackingWorkspace, randomToken } from "../fixtures/seed";
import { buildPageviewPayload, REAL_CHROME_UA } from "../fixtures/track";
import { INGEST_BASE_URL } from "../fixtures/env";

async function usageFor(workspaceId: string): Promise<number> {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { usage: true },
  });
  return ws.usage;
}

async function track(request: import("@playwright/test").APIRequestContext, body: unknown) {
  return request.post(`${INGEST_BASE_URL}/api/track`, {
    headers: { "user-agent": REAL_CHROME_UA },
    data: body,
  });
}

test.describe("tracking idempotency (event_id dedup on /api/track)", () => {
  test("duplicate event_id counts once, not twice", async ({ request }) => {
    const ws = await createTrackingWorkspace("idem-dup");
    const eventId = randomToken("evt");
    const payload = buildPageviewPayload({ websiteId: ws.projectToken!, eventId });

    const first = await track(request, payload);
    const second = await track(request, payload);

    expect(first.ok()).toBe(true);
    expect(second.ok()).toBe(true);
    expect(await usageFor(ws.id)).toBe(1);
  });

  test("different event_id counts both", async ({ request }) => {
    const ws = await createTrackingWorkspace("idem-distinct");

    await track(request, buildPageviewPayload({ websiteId: ws.projectToken!, eventId: randomToken("evt") }));
    await track(request, buildPageviewPayload({ websiteId: ws.projectToken!, eventId: randomToken("evt") }));

    expect(await usageFor(ws.id)).toBe(2);
  });

  test("no event_id at all skips dedup entirely (backward compat with older cached clients)", async ({
    request,
  }) => {
    const ws = await createTrackingWorkspace("idem-no-id");
    const payload = buildPageviewPayload({ websiteId: ws.projectToken! }); // no eventId

    await track(request, payload);
    await track(request, payload);

    expect(await usageFor(ws.id)).toBe(2);
  });

  test("cookieless duplicate still returns a visitorId in the response", async ({ request }) => {
    const ws = await createTrackingWorkspace("idem-cookieless");
    const eventId = randomToken("evt");
    const payload = buildPageviewPayload({
      websiteId: ws.projectToken!,
      eventId,
      cookieless: true,
    });

    await track(request, payload);
    const second = await track(request, payload);

    expect(second.ok()).toBe(true);
    const body = await second.json();
    expect(body.duplicate).toBe(true);
    expect(typeof body.visitorId).toBe("string");
    expect(body.visitorId.length).toBeGreaterThan(0);
  });
});

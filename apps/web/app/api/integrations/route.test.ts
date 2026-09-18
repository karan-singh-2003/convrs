import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/db", () => ({
  prisma: { integration: { findMany: vi.fn() } },
}));
vi.mock("@/lib/api/integrations/authorize-workspace", () => ({
  authorizeWorkspaceForIntegrations: vi.fn(),
}));

import { prisma } from "@repo/db";
import { authorizeWorkspaceForIntegrations } from "@/lib/api/integrations/authorize-workspace";
import { GET } from "./route";

describe("GET /api/integrations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects the request when authorization fails, without touching the database (the bug this fixes)", async () => {
    (authorizeWorkspaceForIntegrations as any).mockResolvedValue({
      ok: false, status: 401, error: "Unauthorized",
    });

    const req = new NextRequest("http://localhost/api/integrations?workspaceId=ws_1");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(prisma.integration.findMany).not.toHaveBeenCalled();
  });

  it("checks workspace:read and queries only the authorized workspaceId", async () => {
    (authorizeWorkspaceForIntegrations as any).mockResolvedValue({ ok: true, workspaceId: "ws_1" });
    (prisma.integration.findMany as any).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/integrations?workspaceId=ws_1");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(authorizeWorkspaceForIntegrations).toHaveBeenCalledWith("ws_1", "workspace:read");
    expect(prisma.integration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws_1" } })
    );
  });

  it("never selects apiKeyEncrypted/webhookSecret", async () => {
    (authorizeWorkspaceForIntegrations as any).mockResolvedValue({ ok: true, workspaceId: "ws_1" });
    (prisma.integration.findMany as any).mockResolvedValue([]);
    await GET(new NextRequest("http://localhost/api/integrations?workspaceId=ws_1"));
    const call = (prisma.integration.findMany as any).mock.calls[0][0];
    expect(call.select.apiKeyEncrypted).toBeUndefined();
    expect(call.select.webhookSecret).toBeUndefined();
  });
});

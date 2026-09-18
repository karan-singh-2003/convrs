import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/db", () => ({
  prisma: {
    integration: { findUnique: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/api/integrations/authorize-workspace", () => ({
  authorizeWorkspaceForIntegrations: vi.fn(),
}));

import { prisma } from "@repo/db";
import { authorizeWorkspaceForIntegrations } from "@/lib/api/integrations/authorize-workspace";
import { GET, DELETE } from "./route";

describe("GET /api/integrations/:provider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("400s for an unknown provider before any auth check", async () => {
    const req = new NextRequest("http://localhost/api/integrations/not-a-provider?workspaceId=ws_1");
    const res = await GET(req, { params: Promise.resolve({ provider: "not-a-provider" }) });
    expect(res.status).toBe(400);
    expect(authorizeWorkspaceForIntegrations).not.toHaveBeenCalled();
  });

  it("rejects when authorization fails (the bug this fixes)", async () => {
    (authorizeWorkspaceForIntegrations as any).mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });
    const req = new NextRequest("http://localhost/api/integrations/stripe?workspaceId=ws_1");
    const res = await GET(req, { params: Promise.resolve({ provider: "stripe" }) });
    expect(res.status).toBe(401);
    expect(prisma.integration.findUnique).not.toHaveBeenCalled();
  });

  it("queries only the authorized workspaceId", async () => {
    (authorizeWorkspaceForIntegrations as any).mockResolvedValue({ ok: true, workspaceId: "ws_1" });
    (prisma.integration.findUnique as any).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/integrations/stripe?workspaceId=ws_1");
    await GET(req, { params: Promise.resolve({ provider: "stripe" }) });
    expect(prisma.integration.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId_provider: { workspaceId: "ws_1", provider: "stripe" } },
      })
    );
  });
});

describe("DELETE /api/integrations/:provider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads workspaceId from the JSON body (unchanged request shape) and authorizes it", async () => {
    (authorizeWorkspaceForIntegrations as any).mockResolvedValue({ ok: true, workspaceId: "ws_1" });
    (prisma.integration.deleteMany as any).mockResolvedValue({ count: 1 });

    const req = new NextRequest("http://localhost/api/integrations/stripe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws_1" }),
    });
    const res = await DELETE(req, { params: Promise.resolve({ provider: "stripe" }) });

    expect(res.status).toBe(200);
    expect(authorizeWorkspaceForIntegrations).toHaveBeenCalledWith("ws_1", "workspace:write");
    expect(prisma.integration.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws_1", provider: "stripe" },
    });
  });

  it("rejects a disconnect attempt for a workspace the caller doesn't own (the bug this fixes)", async () => {
    (authorizeWorkspaceForIntegrations as any).mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });

    const req = new NextRequest("http://localhost/api/integrations/stripe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: "someone_elses_workspace" }),
    });
    const res = await DELETE(req, { params: Promise.resolve({ provider: "stripe" }) });

    expect(res.status).toBe(401);
    expect(prisma.integration.deleteMany).not.toHaveBeenCalled();
  });
});

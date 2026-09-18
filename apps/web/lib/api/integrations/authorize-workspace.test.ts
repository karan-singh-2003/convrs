import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@repo/db", () => ({
  prisma: { workspace: { findFirst: vi.fn() } },
}));
vi.mock("../../auth", () => ({ getSession: vi.fn() }));

import { prisma } from "@repo/db";
import { getSession } from "../../auth";
import { authorizeWorkspaceForIntegrations } from "./authorize-workspace";

describe("authorizeWorkspaceForIntegrations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("400s on a missing identifier", async () => {
    const result = await authorizeWorkspaceForIntegrations(undefined, "workspace:read");
    expect(result).toEqual({ ok: false, status: 400, error: "Missing workspace id" });
  });

  it("401s when there is no session (the bug this fixes: previously no check at all)", async () => {
    (getSession as any).mockResolvedValue(null);
    const result = await authorizeWorkspaceForIntegrations("ws_1", "workspace:read");
    expect(result).toEqual({ ok: false, status: 401, error: "Unauthorized" });
    expect(prisma.workspace.findFirst).not.toHaveBeenCalled();
  });

  it("404s when the workspace doesn't exist", async () => {
    (getSession as any).mockResolvedValue({ user: { id: "user_1" } });
    (prisma.workspace.findFirst as any).mockResolvedValue(null);
    const result = await authorizeWorkspaceForIntegrations("ws_missing", "workspace:read");
    expect(result).toEqual({ ok: false, status: 404, error: "Workspace not found" });
  });

  it("401s when the session user isn't a member (IDOR: guessing another workspace's id)", async () => {
    (getSession as any).mockResolvedValue({ user: { id: "user_outsider" } });
    (prisma.workspace.findFirst as any).mockResolvedValue({ id: "ws_1", users: [] });
    const result = await authorizeWorkspaceForIntegrations("ws_1", "workspace:read");
    expect(result).toEqual({ ok: false, status: 401, error: "Unauthorized" });
  });

  it("403s when the member's role lacks the required permission", async () => {
    (getSession as any).mockResolvedValue({ user: { id: "user_viewer" } });
    (prisma.workspace.findFirst as any).mockResolvedValue({
      id: "ws_1",
      users: [{ role: "viewer" }],
    });
    const result = await authorizeWorkspaceForIntegrations("ws_1", "workspace:write");
    expect(result).toEqual({ ok: false, status: 403, error: "Forbidden" });
  });

  it("succeeds for an owner with the required permission", async () => {
    (getSession as any).mockResolvedValue({ user: { id: "user_owner" } });
    (prisma.workspace.findFirst as any).mockResolvedValue({
      id: "ws_1",
      users: [{ role: "owner" }],
      subscriptionStatus: "active",
    });
    const result = await authorizeWorkspaceForIntegrations("ws_1", "workspace:write");
    expect(result).toEqual({ ok: true, workspaceId: "ws_1" });
  });

  it("resolves by slug as well as id", async () => {
    (getSession as any).mockResolvedValue({ user: { id: "user_owner" } });
    (prisma.workspace.findFirst as any).mockResolvedValue({
      id: "ws_1",
      users: [{ role: "owner" }],
      subscriptionStatus: "active",
    });
    await authorizeWorkspaceForIntegrations("my-workspace-slug", "workspace:read");
    expect(prisma.workspace.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ id: "my-workspace-slug" }, { slug: "my-workspace-slug" }] },
      })
    );
  });

  it("402s (billing-wall API bypass fix) when the workspace has no active subscription/trial, even for the owner", async () => {
    (getSession as any).mockResolvedValue({ user: { id: "user_owner" } });
    (prisma.workspace.findFirst as any).mockResolvedValue({
      id: "ws_1",
      users: [{ role: "owner" }],
      subscriptionStatus: "canceled",
    });
    const result = await authorizeWorkspaceForIntegrations("ws_1", "workspace:write");
    expect(result).toEqual({
      ok: false,
      status: 402,
      error: "This workspace does not have an active subscription or trial.",
    });
  });
});

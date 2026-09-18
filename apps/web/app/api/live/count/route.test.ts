import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/db", () => ({
  prisma: {
    workspace: { findUnique: vi.fn() },
    workspaceUsers: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/analytics/live-visitors", () => ({ getLiveStats: vi.fn() }));

import { prisma } from "@repo/db";
import { getServerSession } from "next-auth";
import { getLiveStats } from "@/lib/analytics/live-visitors";
import { GET } from "./route";

function req(projectToken?: string) {
  const url = projectToken
    ? `http://localhost/api/live/count?projectToken=${projectToken}`
    : "http://localhost/api/live/count";
  return new NextRequest(url);
}

describe("GET /api/live/count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getLiveStats as any).mockResolvedValue({
      count: 1, pages: [], points: [], referrers: [], countries: [],
    });
  });

  it("400s when projectToken is missing", async () => {
    const res = await GET(req());
    expect(res.status).toBe(400);
    expect(getLiveStats).not.toHaveBeenCalled();
  });

  it("404s for a projectToken that doesn't match any workspace", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue(null);
    const res = await GET(req("pt_unknown"));
    expect(res.status).toBe(404);
    expect(getLiveStats).not.toHaveBeenCalled();
  });

  it("allows anonymous reads for a public workspace", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue({ id: "ws_1", isPublic: true });
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(req("pt_public"));
    expect(res.status).toBe(200);
    expect(getLiveStats).toHaveBeenCalledWith("pt_public");
  });

  it("blocks anonymous reads for a private workspace (the bug this fixes)", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue({ id: "ws_1", isPublic: false });
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(req("pt_private"));
    expect(res.status).toBe(401);
    expect(getLiveStats).not.toHaveBeenCalled();
  });

  it("blocks a logged-in user who isn't a member of the private workspace", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue({ id: "ws_1", isPublic: false });
    (getServerSession as any).mockResolvedValue({ user: { id: "user_outsider" } });
    (prisma.workspaceUsers.findFirst as any).mockResolvedValue(null);
    const res = await GET(req("pt_private"));
    expect(res.status).toBe(401);
    expect(getLiveStats).not.toHaveBeenCalled();
  });

  it("allows a member of the private workspace", async () => {
    (prisma.workspace.findUnique as any).mockResolvedValue({ id: "ws_1", isPublic: false });
    (getServerSession as any).mockResolvedValue({ user: { id: "user_member" } });
    (prisma.workspaceUsers.findFirst as any).mockResolvedValue({ id: "wu_1" });
    const res = await GET(req("pt_private"));
    expect(res.status).toBe(200);
    expect(getLiveStats).toHaveBeenCalledWith("pt_private");
  });
});

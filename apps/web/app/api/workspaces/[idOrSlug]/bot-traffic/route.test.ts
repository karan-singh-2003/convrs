import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  // Permission checks are withWorkspace's own job (lib/auth/workspace.test.ts);
  // here it just hands the handler a fixed workspace and session.
  withWorkspace: (handler: (ctx: any) => Promise<Response>) => (req: Request) =>
    handler({ req, workspace: { id: "ws_1" }, session: { user: { id: "user_1" } } }),
  hashToken: vi.fn(async (t: string) => `hashed:${t}`),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    workspace: { findUnique: vi.fn(), update: vi.fn() },
    restrictedToken: { findFirst: vi.fn(), count: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { GET, PATCH } from "./route";

const db = prisma as any;
const URL_ = "http://localhost/api/workspaces/ws_1/bot-traffic";
const get = () => GET(new NextRequest(URL_), {} as any);
const patch = (body: unknown) =>
  PATCH(new NextRequest(URL_, { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ idOrSlug: "ws_1" }),
  } as any);

beforeEach(() => {
  vi.clearAllMocks();
  db.restrictedToken.findFirst.mockResolvedValue(null);
});

describe("Bot Traffic settings", () => {
  it("reports the stored setting, and treats a missing value as optional auth", async () => {
    db.workspace.findUnique.mockResolvedValueOnce({ botTrafficRequireAuth: true });
    expect((await (await get()).json()).requireAuth).toBe(true);

    db.workspace.findUnique.mockResolvedValueOnce({ botTrafficRequireAuth: false });
    expect((await (await get()).json()).requireAuth).toBe(false);

    db.workspace.findUnique.mockResolvedValueOnce(null);
    expect((await (await get()).json()).requireAuth).toBe(false);
  });

  it("refuses to require auth while the website has no usable token", async () => {
    db.restrictedToken.count.mockResolvedValue(0);
    const res = await patch({ requireAuth: true });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Generate a bot traffic token/);
    expect(db.workspace.update).not.toHaveBeenCalled();
  });

  it("requires auth once a token exists, and can always turn it off", async () => {
    db.restrictedToken.count.mockResolvedValue(1);
    db.workspace.findUnique.mockResolvedValue({ botTrafficRequireAuth: true });
    expect((await patch({ requireAuth: true })).status).toBe(200);
    expect(db.workspace.update).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { botTrafficRequireAuth: true },
    });

    db.restrictedToken.count.mockClear();
    db.workspace.findUnique.mockResolvedValue({ botTrafficRequireAuth: false });
    expect((await patch({ requireAuth: false })).status).toBe(200);
    expect(db.restrictedToken.count).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean setting", async () => {
    expect((await patch({ requireAuth: "yes" })).status).toBe(400);
  });
});

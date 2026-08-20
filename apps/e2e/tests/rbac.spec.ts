import { test, expect } from "@playwright/test";
import { prisma } from "../fixtures/db";
import { WORKSPACES, USERS } from "../fixtures/seed-data";

test.describe("RBAC / authorization", () => {
  test.describe("member role", () => {
    test.use({ storageState: ".auth/member.json" });

    test("cannot change another member's role (requires workspace:write, member only has workspace:read)", async ({
      request,
    }) => {
      const viewer = await prisma.user.findUniqueOrThrow({
        where: { email: USERS.viewer.email },
      });

      const response = await request.patch(`/api/workspaces/${WORKSPACES.main.slug}/users`, {
        data: { userId: viewer.id, role: "billing" },
      });

      expect(response.status()).toBe(403);

      const stillViewer = await prisma.workspaceUsers.findFirst({
        where: { userId: viewer.id, workspace: { slug: WORKSPACES.main.slug } },
      });
      expect(stillViewer?.role).toBe("viewer");
    });

    test("cannot access a workspace it is not a member of", async ({ request }) => {
      const response = await request.get(`/api/workspaces/${WORKSPACES.ssoEnforced.slug}`);
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toMatch(/unauthorized/i);
    });
  });

  test.describe("viewer role", () => {
    test.use({ storageState: ".auth/viewer.json" });

    test("cannot write to the workspace it belongs to", async ({ request }) => {
      const member = await prisma.user.findUniqueOrThrow({
        where: { email: USERS.member.email },
      });

      const response = await request.patch(`/api/workspaces/${WORKSPACES.main.slug}/users`, {
        data: { userId: member.id, role: "billing" },
      });

      expect(response.status()).toBe(403);
    });

    test("can still read the workspace it belongs to", async ({ request }) => {
      const response = await request.get(`/api/workspaces/${WORKSPACES.main.slug}`);
      expect(response.ok()).toBe(true);
    });
  });

  test.describe("owner role — positive control", () => {
    test.use({ storageState: ".auth/owner.json" });

    test("can change a member's role (proves the 403s above are real, not a broken endpoint)", async ({
      request,
    }) => {
      // Dedicated throwaway user/membership so this mutation can't affect
      // any other spec's fixtures (viewer/member roles are relied on by
      // other tests' storageState).
      const target = await prisma.user.create({
        data: {
          email: `e2e-rbac-target-${Date.now()}@e2e.test`,
          name: "E2E RBAC Target",
          passwordHash: "unused",
          emailVerified: new Date(),
        },
      });
      const workspace = await prisma.workspace.findUniqueOrThrow({
        where: { slug: WORKSPACES.main.slug },
      });
      await prisma.workspaceUsers.create({
        data: { workspaceId: workspace.id, userId: target.id, role: "member" },
      });

      const response = await request.patch(`/api/workspaces/${WORKSPACES.main.slug}/users`, {
        data: { userId: target.id, role: "billing" },
      });

      expect(response.ok()).toBe(true);
      const updated = await prisma.workspaceUsers.findFirst({
        where: { userId: target.id, workspaceId: workspace.id },
      });
      expect(updated?.role).toBe("billing");
    });
  });
});

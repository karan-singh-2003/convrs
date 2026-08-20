import { test, expect } from "@playwright/test";
import { prisma } from "../fixtures/db";
import { fillLoginForm } from "../fixtures/ui";
import { PASSWORD, USERS, WORKSPACES } from "../fixtures/seed-data";

test.describe("workspace invitation flow", () => {
  test.describe("accepting a pending invite", () => {
    test.use({ storageState: ".auth/invited-to-accept.json" });

    test("accept invite adds membership and redirects into the workspace", async ({ page }) => {
      await page.goto(`/${WORKSPACES.main.slug}/invite`);
      await page.getByRole("button", { name: "Accept Invite" }).click();

      await page.waitForURL(new RegExp(`/${WORKSPACES.main.slug}(?!/invite)`), {
        timeout: 10_000,
      });

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: USERS.invitedToAccept.email },
      });
      const membership = await prisma.workspaceUsers.findFirst({
        where: { userId: user.id, workspace: { slug: WORKSPACES.main.slug } },
      });
      expect(membership).not.toBeNull();
      expect(membership?.role).toBe("member");
    });
  });

  test("an expired invite shows an expired state and grants no membership", async ({ page }) => {
    await fillLoginForm(page, USERS.invitedExpired.email, PASSWORD);
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

    await page.goto(`/${WORKSPACES.main.slug}/invite`);
    await expect(page.getByText(/expired/i)).toBeVisible({ timeout: 10_000 });

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: USERS.invitedExpired.email },
    });
    const membership = await prisma.workspaceUsers.findFirst({
      where: { userId: user.id, workspace: { slug: WORKSPACES.main.slug } },
    });
    expect(membership).toBeNull();
  });

  test.describe("regression: pending invite is reachable through withWorkspace (not swallowed by the 404 check)", () => {
    test.use({ storageState: ".auth/invited-pending.json" });

    test("a non-member with a pending invite gets a pending-invite response, not a generic 404", async ({
      request,
    }) => {
      const response = await request.get(`/api/workspaces/${WORKSPACES.main.slug}`);
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toMatch(/pending invite/i);
    });
  });
});

import { test, expect } from "@playwright/test";
import { prisma } from "../fixtures/db";
import { fillLoginForm, fillOtpWidget, expectLoggedIn } from "../fixtures/ui";
import { PASSWORD, USERS } from "../fixtures/seed-data";
import { randomToken } from "../fixtures/seed";

test.describe("authentication", () => {
  test("register: real OTP round trip creates a verified, logged-in account", async ({ page }) => {
    // This is the only test in the suite that ever navigates to
    // /onboarding/new, so it pays Turbopack's cold compile for that route on
    // top of the OTP round trip. Confirmed via isolated runs (app reliably
    // reaches /onboarding/new in ~14s total with no contention) and via a
    // failure screenshot showing the dev-server "Compiling..." indicator
    // still active with the OTP already submitted — this is first-navigation
    // compile latency under this run's parallel workers, not a stuck/broken
    // flow. See auth.setup.ts for the same pattern on the dashboard route.
    test.setTimeout(90_000);
    const email = `${randomToken("e2e-register")}@e2e.test`;

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: /Sign Up/i }).click();

    // The OTP is real — sent via the app's own send-otp action and stored in
    // EmailVerificationToken. We read it directly from the disposable DB
    // (legitimate test-fixture access, not mocking the app) rather than
    // needing an email-capture harness.
    await expect
      .poll(
        async () =>
          prisma.emailVerificationToken.findFirst({ where: { identifier: email } }),
        { message: "waiting for the OTP row to be created", timeout: 15_000 }
      )
      .not.toBeNull();

    const tokenRow = await prisma.emailVerificationToken.findFirstOrThrow({
      where: { identifier: email },
    });

    await fillOtpWidget(page, tokenRow.token);

    await page.waitForURL(/\/onboarding\/new/, { timeout: 60_000 });
    await expectLoggedIn(page);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.emailVerified).toBeTruthy();
    expect(user?.passwordHash).toBeTruthy();
  });

  test("login: happy path with a verified, no-2FA account", async ({ page }) => {
    await fillLoginForm(page, USERS.owner.email, PASSWORD);
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
    await expectLoggedIn(page);
  });

  test("login: wrong password is rejected, no session is created", async ({ page }) => {
    await fillLoginForm(page, USERS.wrongPassword.email, "not-the-real-password");

    await expect(page.getByText(/incorrect/i)).toBeVisible({ timeout: 10_000 });

    const response = await page.request.get("/api/auth/session");
    const body = await response.json();
    expect(body?.user).toBeFalsy();
  });
});

import { test, expect } from "@playwright/test";
import {
  fillLoginForm,
  fillOtpWidget,
  submitTwoFactorChallengeCode,
  expectLoggedIn,
} from "../fixtures/ui";
import { currentTotpCode, wrongTotpCode } from "../fixtures/totp";
import { PASSWORD, USERS, TOTP_SECRETS } from "../fixtures/seed-data";

async function expectNoSession(page: import("@playwright/test").Page) {
  await expect
    .poll(
      async () => {
        const res = await page.request.get("/api/auth/session");
        const body = await res.json().catch(() => ({}));
        return !!body?.user;
      },
      { message: "expected no session to ever be created", timeout: 5_000 }
    )
    .toBe(false);
}

test.describe("two-factor authentication", () => {
  test("enable, confirm, and log back in with a real TOTP code", async ({ page }) => {
    await fillLoginForm(page, USERS.twoFactorEnrolling.email, PASSWORD);
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

    await page.goto("/account/settings/security");
    await page.getByRole("button", { name: "Enable Two-factor" }).click();

    const secret = await page.locator("span.select-all.font-mono").innerText();
    expect(secret).toMatch(/^[A-Z2-7]+$/);

    await fillOtpWidget(page, currentTotpCode(secret));
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(/enabled successfully/i)).toBeVisible({ timeout: 10_000 });

    // Log out (clearing the session cookie is equivalent to the app's own
    // logout for our purposes here — we're not testing the logout UI).
    await page.context().clearCookies();

    await fillLoginForm(page, USERS.twoFactorEnrolling.email, PASSWORD);
    await page.waitForURL(/\/two-factor-challenge/, { timeout: 10_000 });
    await submitTwoFactorChallengeCode(page, currentTotpCode(secret));

    await page.waitForURL((url) => !url.pathname.startsWith("/two-factor-challenge"), {
      timeout: 10_000,
    });
    await expectLoggedIn(page);
  });

  test("wrong TOTP code at the challenge is rejected", async ({ page }) => {
    await fillLoginForm(page, USERS.twoFactorReady.email, PASSWORD);
    await page.waitForURL(/\/two-factor-challenge/, { timeout: 10_000 });

    const wrong = wrongTotpCode(currentTotpCode(TOTP_SECRETS.ready));
    await submitTwoFactorChallengeCode(page, wrong);

    await expectNoSession(page);
  });

  test("a corrupted (tampered) encrypted secret fails cleanly, not with a crash", async ({
    page,
  }) => {
    await fillLoginForm(page, USERS.twoFactorTampered.email, PASSWORD);
    await page.waitForURL(/\/two-factor-challenge/, { timeout: 10_000 });

    // We can't compute a "correct" code — the stored secret is corrupted —
    // any 6-digit code exercises decrypt()'s GCM auth-tag failure path.
    await submitTwoFactorChallengeCode(page, "000000");

    // The important assertion: the app handled the decrypt() throw without
    // ever issuing a session, and without hanging/crashing the page.
    await expectNoSession(page);
    await expect(page.locator("body")).not.toContainText(/internal server error/i);
  });

  test("a legacy pre-migration plaintext secret still authenticates", async ({ page }) => {
    await fillLoginForm(page, USERS.twoFactorLegacy.email, PASSWORD);
    await page.waitForURL(/\/two-factor-challenge/, { timeout: 10_000 });

    await submitTwoFactorChallengeCode(page, currentTotpCode(TOTP_SECRETS.legacy));

    await page.waitForURL((url) => !url.pathname.startsWith("/two-factor-challenge"), {
      timeout: 10_000,
    });
    await expectLoggedIn(page);
  });
});

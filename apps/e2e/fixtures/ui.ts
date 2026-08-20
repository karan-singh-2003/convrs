import { expect, type Page } from "@playwright/test";

/**
 * Drives the real two-step (email, then password) login form
 * (apps/web/ui/auth/login/email-sign-in.tsx). Leaves the page wherever the
 * app navigates to on success — callers assert on the outcome themselves,
 * since that differs (redirect to /, /two-factor-challenge, an error toast).
 */
export async function fillLoginForm(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /Continue with email/i }).click();
  // exact: true — "Password" is otherwise a case-insensitive substring match
  // of the password input's own "Show password" visibility-toggle button
  // (aria-label), which trips Playwright's strict-mode duplicate-match check.
  await page.getByLabel("Password", { exact: true }).waitFor({ state: "visible" });
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Continue with password/i }).click();
}

/** Fills and submits the 6-digit code on the standalone /two-factor-challenge page. */
export async function submitTwoFactorChallengeCode(page: Page, code: string) {
  await page.getByLabel("Authentication code").fill(code);
  await page.getByRole("button", { name: /Verify code/i }).click();
}

/**
 * Types a code into an input-otp (https://github.com/guilhermerodz/input-otp)
 * widget. The library renders exactly one real, visually-hidden <input> with
 * autocomplete="one-time-code" behind N visual "slot" divs — target that
 * input directly rather than the slots, which aren't real form controls.
 */
export async function fillOtpWidget(page: Page, code: string) {
  const input = page.locator('input[autocomplete="one-time-code"]');
  await input.waitFor({ state: "attached" });
  await input.click({ force: true });
  await input.pressSequentially(code, { delay: 20 });
}

export async function expectLoggedIn(page: Page) {
  // NextAuth's own session endpoint is a stable, UI-independent signal that
  // a session cookie was actually issued.
  const response = await page.request.get("/api/auth/session");
  const body = await response.json();
  expect(body?.user?.id, "expected an authenticated session after login").toBeTruthy();
}

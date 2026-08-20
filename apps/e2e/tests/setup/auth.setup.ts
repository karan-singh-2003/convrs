import { test as setup } from "@playwright/test";
import { fillLoginForm, expectLoggedIn } from "../../fixtures/ui";
import { PASSWORD, USERS } from "../../fixtures/seed-data";

const ROLES: { key: string; email: string }[] = [
  { key: "owner", email: USERS.owner.email },
  { key: "member", email: USERS.member.email },
  { key: "viewer", email: USERS.viewer.email },
  { key: "invited-pending", email: USERS.invitedPending.email },
  { key: "invited-to-accept", email: USERS.invitedToAccept.email },
];

for (const { key, email } of ROLES) {
  setup(`authenticate as ${key}`, async ({ page }) => {
    // This is the very first navigation to the post-login dashboard route
    // (/app.convrs.dev/[slug]) in the whole run, so it pays Turbopack's cold
    // compile for that route on top of the login round-trip — observed to
    // exceed the 15s sub-timeout used elsewhere in this suite for the same
    // navigation once that route is already warm. Give this one test a wider
    // budget rather than raising the timeout for every already-warm caller.
    setup.setTimeout(90_000);
    await fillLoginForm(page, email, PASSWORD);
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
    await expectLoggedIn(page);
    await page.context().storageState({ path: `.auth/${key}.json` });
  });
}

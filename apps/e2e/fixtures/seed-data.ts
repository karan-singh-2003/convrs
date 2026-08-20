/**
 * Fixed identifiers for the fixtures global-setup seeds once per run.
 * Kept as plain constants (rather than re-querying the DB from every spec)
 * since global-setup fully truncates the disposable branch before seeding —
 * there is never a stale/leftover row to collide with.
 */

export const PASSWORD = "E2eTestPassw0rd!";

export const USERS = {
  owner: { email: "e2e-owner@e2e.test", name: "E2E Owner" },
  member: { email: "e2e-member@e2e.test", name: "E2E Member" },
  viewer: { email: "e2e-viewer@e2e.test", name: "E2E Viewer" },
  invitedPending: { email: "e2e-invited-pending@e2e.test", name: "E2E Invited Pending" },
  invitedToAccept: { email: "e2e-invited-accept@e2e.test", name: "E2E Invited ToAccept" },
  invitedExpired: { email: "e2e-invited-expired@e2e.test", name: "E2E Invited Expired" },
  twoFactorReady: { email: "e2e-2fa-ready@e2e.test", name: "E2E 2FA Ready" },
  twoFactorTampered: { email: "e2e-2fa-tampered@e2e.test", name: "E2E 2FA Tampered" },
  twoFactorLegacy: { email: "e2e-2fa-legacy@e2e.test", name: "E2E 2FA Legacy" },
  twoFactorEnrolling: { email: "e2e-2fa-enrolling@e2e.test", name: "E2E 2FA Enrolling" },
  ssoDomainUser: { email: "e2e-user@e2e-sso-domain.test", name: "E2E SSO Domain User" },
  wrongPassword: { email: "e2e-wrong-password@e2e.test", name: "E2E Wrong Password" },
} as const;

export const WORKSPACES = {
  main: { name: "E2E Main Workspace", slug: "e2e-main" },
  ssoEnforced: {
    name: "E2E SSO Workspace",
    slug: "e2e-sso",
    ssoEmailDomain: "e2e-sso-domain.test",
  },
} as const;

// Plaintext base32 TOTP secrets used to pre-seed already-2FA-enabled test
// users (so their correct/incorrect codes are computable without driving
// the enable-2FA UI flow for every case). Fixed, not random, so failures are
// reproducible.
export const TOTP_SECRETS = {
  ready: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
  tampered: "KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU",
  legacy: "MFRGGZDFMZTWQ2LKMFRGGZDFMZTWQ2LK",
} as const;

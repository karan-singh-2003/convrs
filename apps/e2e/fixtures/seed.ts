import { hash } from "bcryptjs";
import { prisma } from "./db";
import { PASSWORD, USERS, WORKSPACES, TOTP_SECRETS } from "./seed-data";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

function randomToken(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

async function createUser(profile: { email: string; name: string }) {
  return prisma.user.create({
    data: {
      email: profile.email,
      name: profile.name,
      passwordHash: await hashPassword(PASSWORD),
      emailVerified: new Date(),
    },
  });
}

async function createTwoFactorUser(
  profile: { email: string; name: string },
  secretBase32: string
) {
  const { encrypt } = await import("@repo/analytics");
  const user = await createUser(profile);
  return prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorSecret: encrypt(secretBase32),
      twoFactorConfirmedAt: new Date(),
    },
  });
}

async function createWorkspace(profile: {
  name: string;
  slug: string;
  ssoEmailDomain?: string;
}) {
  return prisma.workspace.create({
    data: {
      name: profile.name,
      slug: profile.slug,
      subscriptionStatus: "active",
      projectToken: randomToken("proj"),
      ssoEmailDomain: profile.ssoEmailDomain,
      ...(profile.ssoEmailDomain && { ssoEnforcedAt: new Date() }),
    },
  });
}

async function addMember(
  workspaceId: string,
  userId: string,
  role: "owner" | "member" | "viewer" | "billing"
) {
  return prisma.workspaceUsers.create({
    data: { workspaceId, userId, role },
  });
}

/**
 * Seeds the fixed dataset every spec relies on: users, the main workspace
 * with owner/member/viewer, the SSO-enforced workspace, pending/expired
 * invites, and pre-enrolled 2FA users. Called once from global-setup after
 * the disposable branch has been truncated.
 */
export async function seedBaseline() {
  const [
    owner,
    member,
    viewer,
    invitedPending,
    invitedToAccept,
    invitedExpired,
    wrongPasswordUser,
    twoFactorEnrolling,
  ] = await Promise.all([
    createUser(USERS.owner),
    createUser(USERS.member),
    createUser(USERS.viewer),
    createUser(USERS.invitedPending),
    createUser(USERS.invitedToAccept),
    createUser(USERS.invitedExpired),
    createUser(USERS.wrongPassword),
    createUser(USERS.twoFactorEnrolling),
  ]);

  const [twoFactorReady, twoFactorTampered, twoFactorLegacyEncrypted] =
    await Promise.all([
      createTwoFactorUser(USERS.twoFactorReady, TOTP_SECRETS.ready),
      createTwoFactorUser(USERS.twoFactorTampered, TOTP_SECRETS.tampered),
      createTwoFactorUser(USERS.twoFactorLegacy, TOTP_SECRETS.legacy),
    ]);

  // Corrupt one hex character of the "tampered" user's stored ciphertext —
  // simulates bit-rot/tampering to exercise the encryption module's GCM
  // auth-tag check through a real login attempt (two-factor.spec.ts).
  const tamperedSecret = (await prisma.user.findUniqueOrThrow({
    where: { id: twoFactorTampered.id },
    select: { twoFactorSecret: true },
  })).twoFactorSecret!;
  const corrupted =
    tamperedSecret.slice(0, -1) +
    (tamperedSecret.at(-1) === "0" ? "1" : "0");
  await prisma.user.update({
    where: { id: twoFactorTampered.id },
    data: { twoFactorSecret: corrupted },
  });

  // "Legacy" user: pre-migration plaintext base32 secret, stored as-is (not
  // through encrypt()) — matches accounts created before the encryption
  // migration. decryptTwoFactorSecret() must pass this through unchanged.
  await prisma.user.update({
    where: { id: twoFactorLegacyEncrypted.id },
    data: { twoFactorSecret: TOTP_SECRETS.legacy },
  });

  const ssoUser = await createUser(USERS.ssoDomainUser);

  const [mainWorkspace, ssoWorkspace] = await Promise.all([
    createWorkspace(WORKSPACES.main),
    createWorkspace(WORKSPACES.ssoEnforced),
  ]);

  await Promise.all([
    addMember(mainWorkspace.id, owner.id, "owner"),
    addMember(mainWorkspace.id, member.id, "member"),
    addMember(mainWorkspace.id, viewer.id, "viewer"),
  ]);

  await Promise.all([
    // Stays pending for the whole run — used by rbac.spec.ts's regression
    // test for the withWorkspace pending-invite fix. Never accept this one.
    prisma.workspaceInvite.create({
      data: {
        email: USERS.invitedPending.email,
        workspaceId: mainWorkspace.id,
        role: "member",
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
    // Consumed by workspace-invite.spec.ts's accept-flow test.
    prisma.workspaceInvite.create({
      data: {
        email: USERS.invitedToAccept.email,
        workspaceId: mainWorkspace.id,
        role: "member",
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
    // Already expired — used by the expired-invite case.
    prisma.workspaceInvite.create({
      data: {
        email: USERS.invitedExpired.email,
        workspaceId: mainWorkspace.id,
        role: "member",
        expires: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  return { mainWorkspace, ssoWorkspace, owner, member, viewer };
}

/**
 * Creates a throwaway workspace with a fresh projectToken/usage=0, for
 * tests that POST directly to /api/track (bot-detection, idempotency).
 * Each test gets its own so tests can run in parallel without racing on a
 * shared usage counter.
 */
export async function createTrackingWorkspace(namePrefix: string) {
  return createWorkspace({
    name: `${namePrefix} ${randomToken("ws")}`,
    slug: randomToken("e2e-track").toLowerCase(),
  });
}

/**
 * Seeds a Stripe Integration row with a known webhookSecret (used to sign
 * test payloads) and a placeholder encrypted API key (never actually called
 * — the controller only uses it to construct a Stripe SDK client, and the
 * checkout.session.completed path makes no further Stripe API calls).
 */
export async function createStripeIntegration(
  workspaceId: string,
  webhookSecret: string
) {
  const { encrypt } = await import("@repo/analytics");
  return prisma.integration.create({
    data: {
      workspaceId,
      provider: "stripe",
      webhookSecret,
      apiKeyEncrypted: encrypt("sk_test_e2e_placeholder_not_a_real_key"),
    },
  });
}

/**
 * LemonSqueezy verification is hand-rolled HMAC over the raw body (see
 * lemonsqueezy-webhook-controller.ts) — no encryption/apiKeyEncrypted
 * involved, unlike Stripe/Paddle.
 */
export async function createLemonSqueezyIntegration(
  workspaceId: string,
  webhookSecret: string
) {
  return prisma.integration.create({
    data: { workspaceId, provider: "lemonsqueezy", webhookSecret },
  });
}

export { randomToken };

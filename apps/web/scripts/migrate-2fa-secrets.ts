// One-off backfill: encrypts any plaintext TOTP secrets left over from
// before the 2FA-encryption fix (see apps/web/lib/actions/auth/enable-two-factor.ts).
//
// Safe to run while the app is live: apps/web/lib/auth/totp.ts's
// decryptTwoFactorSecret() already accepts both plaintext and encrypted
// secrets, so login/2FA-confirm never breaks mid-migration. Idempotent:
// already-encrypted rows are skipped on a re-run.
//
// Usage (dry run first, always):
//   pnpm --filter web exec dotenv-flow -e .env -- tsx scripts/migrate-2fa-secrets.ts --dry-run
//   pnpm --filter web exec dotenv-flow -e .env -- tsx scripts/migrate-2fa-secrets.ts
//
// DO NOT run against production without first:
//   1. Verifying ENCRYPTION_KEY in the target environment is the correct,
//      stable, already-in-use production key — NOT a placeholder or a
//      per-environment-different value. If the key used here doesn't match
//      the key the app runs with at read time, every migrated secret
//      becomes permanently undecryptable (see risk notes in chat).
//   2. Confirming a recent DB backup / point-in-time-recovery snapshot exists.
//   3. Running --dry-run and reviewing the reported count against the
//      expected number of 2FA-enabled users.

import { prisma } from "@repo/db";
import { encrypt } from "@repo/analytics";

// Mirrors ENCRYPTED_SECRET_PATTERN in apps/web/lib/auth/totp.ts — keep in sync.
const ENCRYPTED_SECRET_PATTERN = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const users = await prisma.user.findMany({
    where: { twoFactorSecret: { not: null } },
    select: { id: true, twoFactorSecret: true },
  });

  const plaintextUsers = users.filter(
    (u) => u.twoFactorSecret && !ENCRYPTED_SECRET_PATTERN.test(u.twoFactorSecret),
  );

  console.log(
    `Found ${users.length} user(s) with a twoFactorSecret set; ${plaintextUsers.length} appear to be plaintext and need migrating.`,
  );

  if (dryRun) {
    console.log("--dry-run: no writes performed.");
    return;
  }

  let migrated = 0;
  for (const user of plaintextUsers) {
    // One row at a time — never log the secret itself.
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: encrypt(user.twoFactorSecret!) },
    });
    migrated++;
  }

  console.log(`Migrated ${migrated} secret(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

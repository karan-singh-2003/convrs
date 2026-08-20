export default async function globalTeardown() {
  // The disposable Neon branch itself is intentionally left in place (it's
  // reused across runs — global-setup truncates it fresh every time), so
  // there's no per-run cloud cleanup. To fully dispose of it:
  //   neonctl branches delete e2e-test --project-id super-mud-92337280
  const { prisma } = await import("./fixtures/db");
  await prisma.$disconnect();
}

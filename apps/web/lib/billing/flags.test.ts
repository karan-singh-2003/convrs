import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// BILLING_V2 is computed once at module load from process.env, so each case
// needs a fresh module instance (vi.resetModules + dynamic import) after
// stubbing the env var, rather than importing it once at the top of the file.

describe("BILLING_V2 flag (Deploy 5: default ON)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("unset -> true (Deploy 5 default: new billing architecture is live)", async () => {
    vi.stubEnv("NEXT_PUBLIC_BILLING_V2", undefined as unknown as string);
    delete process.env.NEXT_PUBLIC_BILLING_V2;
    const { BILLING_V2 } = await import("./flags");
    expect(BILLING_V2).toBe(true);
  });

  it('explicitly "false" -> false (opt back into the legacy UI for diagnosis)', async () => {
    vi.stubEnv("NEXT_PUBLIC_BILLING_V2", "false");
    const { BILLING_V2 } = await import("./flags");
    expect(BILLING_V2).toBe(false);
  });

  it('explicitly "true" -> true', async () => {
    vi.stubEnv("NEXT_PUBLIC_BILLING_V2", "true");
    const { BILLING_V2 } = await import("./flags");
    expect(BILLING_V2).toBe(true);
  });

  it("any other value (typo etc.) -> true (fail open to the new architecture, not the old one)", async () => {
    vi.stubEnv("NEXT_PUBLIC_BILLING_V2", "nope");
    const { BILLING_V2 } = await import("./flags");
    expect(BILLING_V2).toBe(true);
  });
});

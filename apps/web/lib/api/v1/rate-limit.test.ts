import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, number>();

vi.mock("@/lib/upstash/redis", () => ({
  redis: {
    incr: vi.fn(async (key: string) => {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    }),
    expire: vi.fn(async () => 1),
  },
}));

import { checkApiRateLimit } from "./rate-limit";

describe("checkApiRateLimit", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("allows requests under the limit", async () => {
    const result = await checkApiRateLimit("tok_1", 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks once the limit is exceeded", async () => {
    for (let i = 0; i < 5; i++) {
      await checkApiRateLimit("tok_2", 5);
    }
    const result = await checkApiRateLimit("tok_2", 5);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks separate tokens independently", async () => {
    for (let i = 0; i < 5; i++) {
      await checkApiRateLimit("tok_a", 5);
    }
    const blocked = await checkApiRateLimit("tok_a", 5);
    const stillAllowed = await checkApiRateLimit("tok_b", 5);
    expect(blocked.allowed).toBe(false);
    expect(stillAllowed.allowed).toBe(true);
  });
});

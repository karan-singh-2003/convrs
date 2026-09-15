import { describe, it, expect } from "vitest";
import { filterDueForReset, type ResetCandidate } from "./usage-reset";

const d = (s: string) => new Date(s);

describe("filterDueForReset", () => {
  it("includes a subscription that has never been reset", () => {
    const c: ResetCandidate = {
      id: "s1",
      currentPeriodStart: d("2026-06-01"),
      lastUsageResetAt: null,
    };
    expect(filterDueForReset([c]).map((x) => x.id)).toEqual(["s1"]);
  });

  it("includes a subscription whose period started after the last reset", () => {
    const c: ResetCandidate = {
      id: "s2",
      currentPeriodStart: d("2026-07-01"),
      lastUsageResetAt: d("2026-06-01"),
    };
    expect(filterDueForReset([c]).map((x) => x.id)).toEqual(["s2"]);
  });

  it("excludes a subscription already reset for the current period", () => {
    const c: ResetCandidate = {
      id: "s3",
      currentPeriodStart: d("2026-07-01"),
      lastUsageResetAt: d("2026-07-01"),
    };
    expect(filterDueForReset([c])).toEqual([]);
  });

  it("excludes a subscription with no period start", () => {
    const c: ResetCandidate = { id: "s4", currentPeriodStart: null, lastUsageResetAt: null };
    expect(filterDueForReset([c])).toEqual([]);
  });

  it("re-run in the same period is a no-op (idempotent anchor)", () => {
    const cands: ResetCandidate[] = [
      { id: "a", currentPeriodStart: d("2026-07-01"), lastUsageResetAt: null },
    ];
    const firstPass = filterDueForReset(cands);
    expect(firstPass).toHaveLength(1);
    // after the cron stamps lastUsageResetAt = currentPeriodStart
    const afterStamp: ResetCandidate[] = [
      { id: "a", currentPeriodStart: d("2026-07-01"), lastUsageResetAt: d("2026-07-01") },
    ];
    expect(filterDueForReset(afterStamp)).toEqual([]);
  });
});

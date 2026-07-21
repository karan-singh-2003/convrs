import { describe, it, expect, vi } from "vitest";

vi.mock("./get-analytics", () => ({
  getAnalytics: vi.fn(),
}));

import { getAnalytics } from "./get-analytics";
import { detectTrafficSpike } from "./traffic-spike";

function buildFlatSeries(hours: number, clicksPerHour: number, spikeAtEnd?: number) {
  const now = new Date();
  const points = Array.from({ length: hours }, (_, i) => {
    const t = new Date(now.getTime() - (hours - i) * 3600_000);
    return { start: t.toISOString(), clicks: clicksPerHour };
  });
  if (spikeAtEnd !== undefined) {
    points.push({ start: now.toISOString(), clicks: spikeAtEnd });
  }
  return points;
}

describe("detectTrafficSpike", () => {
  it("flags a spike when clicks are far above baseline", async () => {
    (getAnalytics as any).mockResolvedValue(buildFlatSeries(14 * 24, 10, 200));
    const result = await detectTrafficSpike("ws_test");
    expect(result.isSpike).toBe(true);
  });

  it("does not flag when traffic is roughly normal", async () => {
    (getAnalytics as any).mockResolvedValue(buildFlatSeries(14 * 24, 10, 12));
    const result = await detectTrafficSpike("ws_test");
    expect(result.isSpike).toBe(false);
  });

  it("ignores ratio-based false positives on low-traffic workspaces", async () => {
    // 2 clicks -> 8 clicks is a 4x ratio but should be suppressed by MIN_ABSOLUTE_CLICKS
    (getAnalytics as any).mockResolvedValue(buildFlatSeries(14 * 24, 2, 8));
    const result = await detectTrafficSpike("ws_test");
    expect(result.isSpike).toBe(false);
  });

  it("does not crash with insufficient history", async () => {
    (getAnalytics as any).mockResolvedValue(buildFlatSeries(2, 10, 500));
    const result = await detectTrafficSpike("ws_test");
    expect(result.currentClicks).toBeGreaterThan(0);
  });
});
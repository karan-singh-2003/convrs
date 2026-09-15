import { describe, it, expect, vi } from "vitest";

vi.mock("./get-analytics", () => ({
  getAnalytics: vi.fn(),
}));

import { getAnalytics } from "./get-analytics";
import {
  detectTrafficSpike,
  isSpikeNotificationAllowed,
  DEFAULT_SPIKE_THRESHOLD,
} from "./traffic-spike";

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

  it("does not crash with insufficient history", async () => {
    (getAnalytics as any).mockResolvedValue(buildFlatSeries(2, 10, 500));
    const result = await detectTrafficSpike("ws_test");
    expect(result.currentClicks).toBeGreaterThan(0);
  });

  it("respects a workspace's configured threshold", async () => {
    (getAnalytics as any).mockResolvedValue(buildFlatSeries(14 * 24, 10, 50));

    const withDefault = await detectTrafficSpike("ws_test");
    expect(withDefault.isSpike).toBe(false);

    const withLowerThreshold = await detectTrafficSpike("ws_test", 30);
    expect(withLowerThreshold.isSpike).toBe(true);
  });

  // The threshold is the sole, explicit trigger — it must not be
  // overridden by the baseline/z-score math, in either direction.
  it("does NOT flag a below-baseline-but-above-threshold spike as a false negative", async () => {
    // baseline is already high (mean 150, stddev 0 -> z-score would read as
    // near-zero for a small bump), but clicks (151) is still > threshold (100)
    (getAnalytics as any).mockResolvedValue(buildFlatSeries(14 * 24, 150, 151));
    const result = await detectTrafficSpike("ws_test", DEFAULT_SPIKE_THRESHOLD);
    expect(result.isSpike).toBe(true);
  });

  it("99 clicks with default threshold 100 -> no spike", async () => {
    (getAnalytics as any).mockResolvedValue(buildFlatSeries(14 * 24, 10, 99));
    const result = await detectTrafficSpike("ws_test", 100);
    expect(result.isSpike).toBe(false);
  });

  it("100 clicks with default threshold 100 -> no spike (equal is not above)", async () => {
    (getAnalytics as any).mockResolvedValue(buildFlatSeries(14 * 24, 10, 100));
    const result = await detectTrafficSpike("ws_test", 100);
    expect(result.isSpike).toBe(false);
  });

  it("101 clicks with default threshold 100 -> spike", async () => {
    (getAnalytics as any).mockResolvedValue(buildFlatSeries(14 * 24, 10, 101));
    const result = await detectTrafficSpike("ws_test", 100);
    expect(result.isSpike).toBe(true);
  });
});

describe("isSpikeNotificationAllowed", () => {
  const now = new Date("2026-09-05T12:00:00.000Z");

  it("blocks when the toggle is off, even if traffic (101) would otherwise spike", () => {
    const gate = isSpikeNotificationAllowed(
      { trafficSpikes: false, lastSpikeSentAt: null },
      { now }
    );
    expect(gate).toEqual({ allowed: false, reason: "disabled" });
  });

  it("blocks when no preference row exists (treated as toggle off)", () => {
    const gate = isSpikeNotificationAllowed(null, { now });
    expect(gate).toEqual({ allowed: false, reason: "disabled" });
  });

  it("allows sending when the toggle is on and there's no prior alert", () => {
    const gate = isSpikeNotificationAllowed(
      { trafficSpikes: true, lastSpikeSentAt: null },
      { now }
    );
    expect(gate).toEqual({ allowed: true });
  });

  it("blocks a duplicate notification within the cooldown window", () => {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const gate = isSpikeNotificationAllowed(
      { trafficSpikes: true, lastSpikeSentAt: oneHourAgo },
      { now, cooldownHours: 6 }
    );
    expect(gate).toEqual({ allowed: false, reason: "cooldown" });
  });

  it("allows a new notification once the cooldown window has elapsed", () => {
    const sevenHoursAgo = new Date(now.getTime() - 7 * 60 * 60 * 1000);
    const gate = isSpikeNotificationAllowed(
      { trafficSpikes: true, lastSpikeSentAt: sevenHoursAgo },
      { now, cooldownHours: 6 }
    );
    expect(gate).toEqual({ allowed: true });
  });
});

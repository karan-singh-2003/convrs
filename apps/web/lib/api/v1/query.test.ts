import { describe, it, expect } from "vitest";
import { resolveDateRange, paginate, MAX_DATE_RANGE_DAYS } from "./query";
import { InvalidRequestError } from "./errors";

describe("resolveDateRange", () => {
  it("falls back to a 30d interval when no dates are given", () => {
    expect(resolveDateRange({})).toEqual({ interval: "30d" });
  });

  it("passes through an explicit interval", () => {
    expect(resolveDateRange({ interval: "7d" })).toEqual({ interval: "7d" });
  });

  it("parses startAt/endAt into Dates", () => {
    const { start, end } = resolveDateRange({
      startAt: "2026-09-01",
      endAt: "2026-09-15",
    });
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
    expect(start!.getTime()).toBeLessThan(end!.getTime());
  });

  it("defaults endAt to now when omitted", () => {
    const { end } = resolveDateRange({ startAt: "2026-09-01" });
    expect(end!.getTime()).toBeGreaterThan(new Date("2026-09-01").getTime());
  });

  it("rejects startAt after endAt", () => {
    expect(() =>
      resolveDateRange({ startAt: "2026-09-15", endAt: "2026-09-01" })
    ).toThrow(InvalidRequestError);
  });

  it("rejects a date range wider than the maximum", () => {
    expect(() =>
      resolveDateRange({
        startAt: "2020-01-01",
        endAt: "2026-01-01",
      })
    ).toThrow(InvalidRequestError);
  });

  it("rejects an unparseable date string", () => {
    expect(() => resolveDateRange({ startAt: "not-a-date" })).toThrow();
  });

  it(`allows exactly ${MAX_DATE_RANGE_DAYS} days`, () => {
    const start = new Date();
    const end = new Date(start.getTime() + MAX_DATE_RANGE_DAYS * 86_400_000);
    expect(() =>
      resolveDateRange({
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      })
    ).not.toThrow();
  });
});

describe("paginate", () => {
  const rows = Array.from({ length: 25 }, (_, i) => i);

  it("slices the first page", () => {
    const { rows: slice, pagination } = paginate(rows, { page: 1, limit: 10 });
    expect(slice).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(pagination).toEqual({ page: 1, limit: 10, hasMore: true });
  });

  it("reports hasMore: false on the last page", () => {
    const { rows: slice, pagination } = paginate(rows, { page: 3, limit: 10 });
    expect(slice).toEqual([20, 21, 22, 23, 24]);
    expect(pagination.hasMore).toBe(false);
  });

  it("returns an empty page past the end without erroring", () => {
    const { rows: slice, pagination } = paginate(rows, { page: 10, limit: 10 });
    expect(slice).toEqual([]);
    expect(pagination.hasMore).toBe(false);
  });
});

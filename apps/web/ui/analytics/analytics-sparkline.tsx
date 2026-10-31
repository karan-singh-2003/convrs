"use client";

import { AnalyticsResponseOptions } from "@/lib/analytics/types";
import { editQueryString } from "@/lib/analytics/utils";
import { cn, fetcher } from "@repo/utils";
import { useContext, useId, useMemo } from "react";
import useSWR from "swr";
import { AnalyticsContext } from "./analytics-providers";

// Sparklines and the placeholder share one coordinate space; the SVGs stretch
// to their container with preserveAspectRatio="none".
const VIEW_W = 100;
const VIEW_H = 40;
// Same vertical band on every card so sparklines read as one uniform set:
// peaks stop 20% below the top, zero sits just above the bottom edge.
const PLOT_TOP = VIEW_H * 0.2;
const PLOT_BOTTOM = VIEW_H - 1;

// Empty-state curve — a fixed decorative shape in its own 400×60 space, never
// derived from data. The badge sits on the curve at its midpoint (x=200).
const PLACEHOLDER_W = 400;
const PLACEHOLDER_H = 60;
const PLACEHOLDER_MID_Y = 26.59;
const PLACEHOLDER_LINE =
  "M0.00,19.01 L6.67,18.50 L13.33,19.10 L20.00,20.10 L26.67,20.83 L33.33,20.99 L40.00,20.73 L46.67,20.53 L53.33,20.83 L60.00,21.80 L66.67,23.18 L73.33,24.46 L80.00,25.14 L86.67,25.06 L93.33,24.48 L100.00,23.95 L106.67,24.02 L113.33,24.87 L120.00,26.15 L126.67,27.12 L133.33,26.97 L140.00,25.25 L146.67,22.17 L153.33,18.58 L160.00,15.66 L166.67,14.43 L173.33,15.31 L180.00,17.97 L186.67,21.45 L193.33,24.61 L200.00,26.59 L206.67,27.10 L213.33,26.50 L220.00,25.50 L226.67,24.77 L233.33,24.61 L240.00,24.87 L246.67,25.07 L253.33,24.77 L260.00,23.80 L266.67,22.42 L273.33,21.14 L280.00,20.46 L286.67,20.54 L293.33,21.12 L300.00,21.65 L306.67,21.58 L313.33,20.73 L320.00,19.45 L326.67,18.48 L333.33,18.63 L340.00,20.35 L346.67,23.43 L353.33,27.02 L360.00,29.94 L366.67,31.17 L373.33,30.29 L380.00,27.63 L386.67,24.15 L393.33,20.99 L400.00,19.01";
const PLACEHOLDER_AREA = `${PLACEHOLDER_LINE} L${PLACEHOLDER_W},${PLACEHOLDER_H} L0,${PLACEHOLDER_H} Z`;

const useSvgId = () => useId().replace(/:/g, "");

// Monotone cubic interpolation (Fritsch–Carlson): smooth like d3's
// curveMonotoneX, but never overshoots — no dips below zero, no fake peaks.
function monotonePath(points: [number, number][]) {
  const n = points.length;
  if (n < 3) {
    return points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  }

  const slopes = points.slice(0, -1).map(([x0, y0], i) => {
    const [x1, y1] = points[i + 1];
    return (y1 - y0) / (x1 - x0);
  });

  const tangents = points.map((_, i) =>
    i === 0
      ? slopes[0]
      : i === n - 1
        ? slopes[n - 2]
        : slopes[i - 1] * slopes[i] <= 0
          ? 0
          : (slopes[i - 1] + slopes[i]) / 2
  );

  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      tangents[i] = tau * a * slopes[i];
      tangents[i + 1] = tau * b * slopes[i];
    }
  }

  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const dx = (x1 - x0) / 3;
    d += ` C ${x0 + dx} ${y0 + tangents[i] * dx}, ${x1 - dx} ${y1 - tangents[i + 1] * dx}, ${x1} ${y1}`;
  }
  return d;
}

// Empty state for KPI charts: a faint gray line with a "No data" pill sitting
// on it, so it can't be mistaken for real values.
export function ChartPlaceholder({
  label = "No data",
  size = "sm",
  className,
}: {
  label?: string;
  // "sm" for the KPI cards, "lg" for the featured chart
  size?: "sm" | "lg";
  className?: string;
}) {
  const gradientId = useSvgId();

  return (
    <div className={cn("relative h-full w-full", className)}>
      <svg
        viewBox={`0 0 ${PLACEHOLDER_W} ${PLACEHOLDER_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 block h-full w-full text-[#DDDDDD] dark:text-neutral-600"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.1} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={PLACEHOLDER_AREA} fill={`url(#${gradientId})`} stroke="none" />
        <path
          d={PLACEHOLDER_LINE}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.6}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        className="absolute inset-x-0 flex -translate-y-1/2 justify-center px-2"
        style={{ top: `${(PLACEHOLDER_MID_Y / PLACEHOLDER_H) * 100}%` }}
      >
        <span
          className={cn(
            "truncate rounded-full border border-border-subtle bg-bg-card font-default font-medium text-content-subtle shadow-sm dark:shadow-none",
            size === "lg" ? "px-4 text-[12.5px] py-1" : "px-2.5 py-0.5 text-[12px]"
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// Compact, axis-less area chart for the KPI cards. Uses the exact same SWR key
// as AnalyticsAreaChart, so whichever KPI is featured shares one request.
export function AnalyticsSparkline({
  resource,
  colorClassName = "text-blue-500 dark:text-blue-400",
}: {
  resource: Exclude<AnalyticsResponseOptions, "live_visitors">;
  colorClassName?: string;
}) {
  const { baseApiPath, queryString } = useContext(AnalyticsContext);

  const { data: response, isLoading } = useSWR<{
    data: Array<{ start: string } & Record<string, number>>;
  }>(
    baseApiPath &&
      `${baseApiPath}?${editQueryString(queryString, {
        groupBy: "timeseries",
        event: resource,
      })}`,
    fetcher
  );

  const values = useMemo(
    () =>
      Array.isArray(response?.data)
        ? response.data
            .filter((row) => !Number.isNaN(new Date(row.start).getTime()))
            .sort(
              (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
            )
            .map((row) => Number(row[resource] ?? 0) || 0)
        : [],
    [response, resource]
  );

  const gradientId = useSvgId();

  const paths = useMemo(() => {
    if (values.length < 2) return null;
    const max = Math.max(...values);
    const min = Math.min(0, ...values);
    const range = max - min || 1;
    const points = values.map((v, i): [number, number] => [
      (i / (values.length - 1)) * VIEW_W,
      PLOT_BOTTOM - ((v - min) / range) * (PLOT_BOTTOM - PLOT_TOP),
    ]);
    const line = monotonePath(points);
    return { line, area: `${line} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z` };
  }, [values]);

  if (isLoading && !response) {
    return <div className="h-full w-full animate-pulse bg-bg-subtle dark:bg-bg-emphasis" />;
  }

  // A single point can't form an area, and an all-zero series is just a flat
  // line — both read better as an explicit empty state.
  if (!paths || values.every((v) => !v)) {
    return <ChartPlaceholder />;
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("pointer-events-none h-full w-full", colorClassName)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0.03} />
        </linearGradient>
      </defs>
      <path d={paths.area} fill={`url(#${gradientId})`} />
      <path
        d={paths.line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

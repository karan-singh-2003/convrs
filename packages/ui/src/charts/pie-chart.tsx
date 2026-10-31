"use client";

import { cn } from "@repo/utils";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { Pie } from "@visx/shape";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

export type PieSlice = {
  id: string;
  label: string;
  value: number;
  colorClassName: string;
};

type PieChartProps<T extends PieSlice> = {
  data: T[];
  /** 0 = full pie, closer to 1 = thinner donut ring. Default 0.6 (donut). */
  innerRadiusRatio?: number;
  /** Gap between slices in radians. Default 0.015. */
  padAngle?: number;
  /** Called when a slice is clicked, e.g. to drill into it. */
  onSliceClick?: (slice: T) => void;
  /** Custom tooltip content for the hovered slice. Positioned centered over the chart. */
  renderTooltip?: (slice: T) => React.ReactNode;
  /** Content rendered in the empty center of a donut (e.g. a total). Ignored for innerRadiusRatio = 0. */
  centerContent?: React.ReactNode;
  emptyState?: React.ReactNode;
  /** Rounds slice corners (px). Default 0. */
  cornerRadius?: number;
  /** Render each slice's label outside the ring with a leader line. */
  showLabels?: boolean;
  /** Content (e.g. icons) drawn at each slice's center; skipped for slivers. */
  renderSliceContent?: (slice: T) => React.ReactNode;
};

// Horizontal room reserved on each side for outside labels, and the leader
// line geometry (radial segment, then a short horizontal run).
const LABEL_SPACE_X = 124;
const LABEL_SPACE_Y = 20;
const LEADER_RADIAL = 14;
const LEADER_HORIZONTAL = 14;
const LABEL_MIN_GAP = 16;
// Slices narrower than this (radians) don't get inside content.
const MIN_CONTENT_ANGLE = 0.3;

type PlacedLabel = {
  id: string;
  label: string;
  side: 1 | -1;
  start: [number, number];
  elbow: [number, number];
  y: number;
};

// Pushes labels on one side apart vertically so neighbours never overlap.
function spreadLabels(labels: PlacedLabel[], maxY: number) {
  const sorted = [...labels].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    sorted[i].y = Math.max(sorted[i].y, sorted[i - 1].y + LABEL_MIN_GAP);
  }
  // If the stack ran off the bottom, shift it back up as a block.
  const overflow = (sorted.at(-1)?.y ?? 0) - maxY;
  if (overflow > 0) {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const next = sorted[i + 1];
      sorted[i].y -= overflow;
      if (next) sorted[i].y = Math.min(sorted[i].y, next.y - LABEL_MIN_GAP);
    }
  }
  return sorted;
}

export function PieChart<T extends PieSlice>(props: PieChartProps<T>) {
  return (
    <div className="relative size-full">
      <ParentSize>
        {({ width, height }) =>
          width > 0 && height > 0 ? (
            <PieChartInner {...props} width={width} height={height} />
          ) : null
        }
      </ParentSize>
    </div>
  );
}

function PieChartInner<T extends PieSlice>({
  width,
  height,
  data,
  innerRadiusRatio = 0.6,
  padAngle = 0.015,
  onSliceClick,
  renderTooltip,
  centerContent,
  emptyState,
  cornerRadius = 0,
  showLabels = false,
  renderSliceContent,
}: PieChartProps<T> & { width: number; height: number }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const radius = showLabels
    ? Math.max(
        Math.min(width / 2 - LABEL_SPACE_X, height / 2 - LABEL_SPACE_Y),
        Math.min(width, height) / 4
      )
    : Math.min(width, height) / 2;
  const outerRadius = radius - 4;
  const innerRadius = outerRadius * innerRadiusRatio;

  const hasData = data.length > 0 && data.some((d) => d.value > 0);
  const hoveredSlice = data.find((d) => d.id === hoveredId);

  if (!hasData) {
    return (
      <div className="flex size-full items-center justify-center text-sm text-content-subtle">
        {emptyState ?? "No data yet."}
      </div>
    );
  }

  return (
    <div className="relative size-full">
      <svg width={width} height={height}>
        <Group top={height / 2} left={width / 2}>
          <Pie
            data={data}
            pieValue={(d) => d.value}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            padAngle={padAngle}
            cornerRadius={cornerRadius}
          >
            {(pie) => {
              // Geometry for outside labels and inside content, from each
              // arc's mid-angle (visx: 0 = 12 o'clock, clockwise).
              const point = (angle: number, r: number): [number, number] => [
                Math.sin(angle) * r,
                -Math.cos(angle) * r,
              ];

              const placed: PlacedLabel[] = showLabels
                ? pie.arcs.map((arc) => {
                    const mid = (arc.startAngle + arc.endAngle) / 2;
                    const elbow = point(mid, outerRadius + LEADER_RADIAL);
                    return {
                      id: arc.data.id,
                      label: arc.data.label,
                      side: elbow[0] >= 0 ? 1 : -1,
                      start: point(mid, outerRadius + 3),
                      elbow,
                      y: elbow[1],
                    };
                  })
                : [];
              const maxY = height / 2 - 8;
              const labels = [
                ...spreadLabels(placed.filter((l) => l.side === 1), maxY),
                ...spreadLabels(placed.filter((l) => l.side === -1), maxY),
              ];

              return (
              <>
              <AnimatePresence>
                {pie.arcs.map((arc) => {
                  const slice = arc.data;
                  const path = pie.path(arc) ?? "";
                  const isDimmed = hoveredId !== null && hoveredId !== slice.id;

                  return (
                    <motion.path
                      key={slice.id}
                      d={path}
                      className={cn(slice.colorClassName, onSliceClick && "cursor-pointer")}
                      fill="currentColor"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isDimmed ? 0.35 : 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onPointerEnter={() => setHoveredId(slice.id)}
                      onPointerLeave={() => setHoveredId(null)}
                      onClick={() => onSliceClick?.(slice)}
                    />
                  );
                })}
              </AnimatePresence>

              {labels.map((l) => {
                const isDimmed = hoveredId !== null && hoveredId !== l.id;
                const endX = l.elbow[0] + LEADER_HORIZONTAL * l.side;
                return (
                  <g
                    key={`label-${l.id}`}
                    className="pointer-events-none transition-opacity duration-150"
                    opacity={isDimmed ? 0.35 : 1}
                  >
                    <polyline
                      points={`${l.start[0]},${l.start[1]} ${l.elbow[0]},${l.y} ${endX},${l.y}`}
                      fill="none"
                      className="text-border-emphasis"
                      stroke="currentColor"
                      strokeWidth={1}
                    />
                    <text
                      x={endX + 6 * l.side}
                      y={l.y}
                      dominantBaseline="middle"
                      textAnchor={l.side === 1 ? "start" : "end"}
                      className="fill-content-default font-alexandria text-[12.5px]"
                    >
                      {l.label}
                    </text>
                  </g>
                );
              })}

              {renderSliceContent &&
                pie.arcs.map((arc) => {
                  if (arc.endAngle - arc.startAngle < MIN_CONTENT_ANGLE) return null;
                  const content = renderSliceContent(arc.data);
                  if (!content) return null;
                  const [x, y] = point(
                    (arc.startAngle + arc.endAngle) / 2,
                    (innerRadius + outerRadius) / 2
                  );
                  return (
                    <foreignObject
                      key={`content-${arc.data.id}`}
                      x={x - 40}
                      y={y - 12}
                      width={80}
                      height={24}
                      className="pointer-events-none overflow-visible"
                    >
                      <div className="flex size-full items-center justify-center">
                        {content}
                      </div>
                    </foreignObject>
                  );
                })}
              </>
              );
            }}
          </Pie>
        </Group>
      </svg>

      {innerRadiusRatio > 0 && centerContent && !hoveredSlice && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {centerContent}
        </div>
      )}

      {hoveredSlice && renderTooltip && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          {renderTooltip(hoveredSlice)}
        </div>
      )}
    </div>
  );
}
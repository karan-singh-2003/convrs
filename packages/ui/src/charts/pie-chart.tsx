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
};

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
}: PieChartProps<T> & { width: number; height: number }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const radius = Math.min(width, height) / 2;
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
          >
            {(pie) => (
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
            )}
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
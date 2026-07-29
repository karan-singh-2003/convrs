// import { cn } from "@repo/utils";
// import { RectClipPath } from "@visx/clip-path";
// import { Group } from "@visx/group";
// import { BarRounded } from "@visx/shape";
// import { AnimatePresence, motion } from "framer-motion";
// import { useId } from "react";
// import { useChartContext } from "./chart-context";


// export function Bars({
//   seriesStyles,
//   radius = 2,
//   series: seriesOverride,
// }: {
//   seriesStyles?: {
//     id: string;
//     barClassName?: string;
//     barFill?: string;
//   }[];
//   radius?: number;
//   series?: typeof useChartContext extends () => infer C
//     ? C extends { series: infer S }
//       ? S
//       : never
//     : never; // optional: render this series list instead of context's
// }) {
//   const clipPathId = useId();
//   const {
//     data,
//     series: contextSeries,
//     margin,
//     xScale,
//     yScale,
//     width,
//     height,
//     startDate,
//     endDate,
//   } = useChartContext();

//   const series = seriesOverride ?? contextSeries;
//   const activeSeries = series.filter(({ isActive }) => isActive !== false);

//   const isBandScale = "bandwidth" in xScale;
//   // For continuous (time) scales, synthesize a bar width from point spacing
//   const syntheticBarWidth = Math.max(
//     2,
//     Math.min(24, (width / Math.max(data.length, 1)) * 0.5)
//   );

//   return (
//     <Group left={margin.left} top={margin.top}>
//       <RectClipPath id={clipPathId} x={0} y={0} width={width} height={height} />
//       <AnimatePresence>
//         <motion.g
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           exit={{ opacity: 0 }}
//           transition={{ duration: 0.1 }}
//           key={`${activeSeries.map((s) => s.id).join(",")}_${startDate.toString()}_${endDate.toString()}`}
//           clipPath={`url(#${clipPathId})`}
//         >
//           {data.map((d) => {
//             const barWidth = isBandScale
//               ? (xScale as any).bandwidth()
//               : syntheticBarWidth;
//             const x = isBandScale
//               ? (xScale(d.date) ?? 0)
//               : (xScale(d.date) ?? 0) - barWidth / 2;

//             const sortedSeries = activeSeries
//               .filter((s) => s.valueAccessor(d) > 0)
//               .sort((a, b) => b.valueAccessor(d) - a.valueAccessor(d));

//             const bars = sortedSeries.reduce((acc, s) => {
//               const stackHeight = acc.reduce((sum, b) => sum + b.height, 0);
//               const value = s.valueAccessor(d) ?? 0;
//               const y = yScale(value);

//               return [
//                 ...acc,
//                 {
//                   id: s.id,
//                   value,
//                   colorClassName: s.colorClassName,
//                   styles: seriesStyles?.find(({ id }) => id === s.id),
//                   y: stackHeight,
//                   height: height - y,
//                 },
//               ];
//             }, [] as any[]);

//             return (
//               <g key={d.date.toString()}>
//                 {bars.map((b, idx) => (
//                   <BarRounded
//                     key={b.id}
//                     x={x}
//                     y={height - b.height - b.y}
//                     width={barWidth}
//                     height={b.height}
//                     className={cn(b.colorClassName ?? "text-blue-700", b.styles?.barClassName)}
//                     fill={b.styles?.barFill || "currentColor"}
//                     {...(idx === bars.length - 1
//                       ? { top: true, radius }
//                       : { radius: 0 })}
//                   />
//                 ))}
//               </g>
//             );
//           })}
//         </motion.g>
//       </AnimatePresence>
//     </Group>
//   );
// }
import { cn } from "@repo/utils";
import { RectClipPath } from "@visx/clip-path";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { BarRounded } from "@visx/shape";
import { AnimatePresence, motion } from "framer-motion";
import { useId, useMemo } from "react";
import { useChartContext } from "./chart-context";

type BarSeriesConfig = {
  id: string;
  isActive?: boolean;
  colorClassName?: string;
  valueAccessor: (d: any) => number; // swap `any` for the real Datum type if you have it
};

type BarSeriesStyle = {
  id: string;
  barClassName?: string;
  barFill?: string;
};

type BarSegment = {
  id: string;
  value: number;
  colorClassName?: string;
  styles?: BarSeriesStyle;
  y: number;
  height: number;
};

export function Bars({
  seriesStyles,
  radius = 2,
  series: seriesOverride,
  maxHeightRatio = 0.35, // when using an overridden series, bars use at most this fraction of chart height
}: {
  seriesStyles?: BarSeriesStyle[];
  radius?: number;
  series?: BarSeriesConfig[];
  maxHeightRatio?: number;
}) {
  const clipPathId = useId();
  const {
    data,
    series: contextSeries,
    margin,
    xScale,
    yScale,
    width,
    height,
    startDate,
    endDate,
  } = useChartContext();

  if (!("bandwidth" in xScale)) {
    // fall through to synthetic width below instead of throwing,
    // since Bars may now be layered on a continuous (area) chart
  }

  const series: BarSeriesConfig[] = seriesOverride ?? contextSeries;
  const activeSeries = series.filter((s) => s.isActive !== false);

  const isBandScale = "bandwidth" in xScale;
  const syntheticBarWidth = Math.max(
    2,
    Math.min(24, (width / Math.max(data.length, 1)) * 0.5)
  );

  // An overridden series (e.g. revenue bars drawn over a clicks/conversion
  // chart) is on a totally different scale than the chart's active metric.
  // Reusing the context's yScale would clamp every bar to the chart's top
  // (the bug you're seeing) since that scale's domain comes from clicks/
  // conversion/etc, not revenue. So: build an independent local scale
  // from this series' own max, capped to maxHeightRatio of the chart height.
  const useIndependentScale = !!seriesOverride;

  const localMax = useMemo(() => {
    if (!useIndependentScale) return 0;
    return data.reduce((m: number, d: any) => {
      const total = activeSeries.reduce(
        (sum: number, s: BarSeriesConfig) => sum + (s.valueAccessor(d) || 0),
        0
      );
      return Math.max(m, total);
    }, 0);
  }, [data, activeSeries, useIndependentScale]);

  const barMaxHeight = height * maxHeightRatio;

  const localScale = useMemo(() => {
    if (!useIndependentScale || localMax <= 0) return null;
    return scaleLinear<number>({
      domain: [0, localMax],
      range: [barMaxHeight, 0],
      clamp: true,
      nice: true,
    });
  }, [useIndependentScale, localMax, barMaxHeight]);

  const heightFor = (value: number) => {
    if (localScale) return barMaxHeight - localScale(value);
    return height - yScale(value);
  };

  return (
    <Group left={margin.left} top={margin.top}>
      <RectClipPath id={clipPathId} x={0} y={0} width={width} height={height} />
      <AnimatePresence>
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          key={`${activeSeries.map((s) => s.id).join(",")}_${startDate.toString()}_${endDate.toString()}`}
          clipPath={`url(#${clipPathId})`}
        >
          {data.map((d: any) => {
            const barWidth = isBandScale ? (xScale as any).bandwidth() : syntheticBarWidth;
            const x = isBandScale
              ? (xScale(d.date) ?? 0)
              : (xScale(d.date) ?? 0) - barWidth / 2;

            const sortedSeries = activeSeries
              .filter((s: BarSeriesConfig) => s.valueAccessor(d) > 0)
              .sort(
                (a: BarSeriesConfig, b: BarSeriesConfig) =>
                  b.valueAccessor(d) - a.valueAccessor(d)
              );

            const bars: BarSegment[] = sortedSeries.reduce(
              (acc: BarSegment[], s: BarSeriesConfig) => {
                const stackHeight = acc.reduce(
                  (sum: number, b: BarSegment) => sum + b.height,
                  0
                );
                const value = s.valueAccessor(d) ?? 0;

                return [
                  ...acc,
                  {
                    id: s.id,
                    value,
                    colorClassName: s.colorClassName,
                    styles: seriesStyles?.find(({ id }) => id === s.id),
                    y: stackHeight,
                    height: heightFor(value),
                  },
                ];
              },
              [] as BarSegment[]
            );

            return (
              <g key={d.date.toString()}>
                {bars.map((b: BarSegment, idx: number) => (
                  <BarRounded
                    key={b.id}
                    x={x}
                    y={height - b.height - b.y}
                    width={barWidth}
                    height={b.height}
                    className={cn(b.colorClassName ?? "text-blue-700", b.styles?.barClassName)}
                    fill={b.styles?.barFill || "currentColor"}
                    {...(idx === bars.length - 1
                      ? { top: true, radius }
                      : { radius: 0 })}
                  />
                ))}
              </g>
            );
          })}
        </motion.g>
      </AnimatePresence>
    </Group>
  );
}
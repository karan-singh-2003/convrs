import { cn } from "@repo/utils";
import { curveMonotoneX } from "@visx/curve";
import { LinearGradient } from "@visx/gradient";
import { Group } from "@visx/group";
import { Area, AreaClosed, Circle } from "@visx/shape";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { useChartContext, useChartTooltipContext } from "./chart-context";

export function Areas({
  seriesStyles,
  showLatestValueCircle = true,
}: {
  seriesStyles?: {
    id: string;
    gradientClassName?: string;
    lineClassName?: string;
    areaFill?: string;
    lineStroke?: string;
  }[];
  showLatestValueCircle?: boolean;
}) {
  const { data, series, margin, xScale, yScale, startDate, endDate } =
    useChartContext();

  if (!("ticks" in xScale))
    throw new Error("Areas require a time scale (type=area)");

  const { tooltipData } = useChartTooltipContext();

  // Series ids double as SVG element ids (mask / gradient) and as `url(#…)`
  // references. Series ids that carry spaces, colons, etc. — e.g. a goal named
  // "Outbound Link: Click" — produce an invalid id, the `url(#…)` reference
  // fails to resolve, the mask never applies, and the area renders as a solid
  // fill instead of the intended top-fade. Sanitise to a valid id fragment and
  // suffix the series index so distinct names can't collide.
  const svgId = (rawId: string, index: number) =>
    `${rawId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${index}`;

  // Data with all values set to zero to animate from
  const zeroedData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      values: Object.fromEntries(Object.keys(d.values).map((key) => [key, 0])),
    })) as typeof data;
  }, [data]);

  return (
    <Group left={margin.left} top={margin.top}>
      <AnimatePresence>
        {series
          .map((s, index) => ({ s, index }))
          .filter(({ s }) => s.isActive)
          .map(({ s, index }) => {
            const seriesStyle = seriesStyles?.find(({ id }) => id === s.id);
            const uid = svgId(s.id, index);
            return (
              // Prevent ugly x-scale animations when start/end dates change with unique key
              <motion.g
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                // TODO: This key changes immediately and sometimes breaks enter/exit animations
                key={`${s.id}_${startDate.toString()}_${endDate.toString()}`}
              >
                {/* Area background mask gradient */}
                <LinearGradient
                  id={`${uid}-mask-gradient`}
                  from="white"
                  to="white"
                  fromOpacity={0.2}
                  toOpacity={0}
                  x1={0}
                  x2={0}
                  y1={0}
                  y2={1}
                />
                <mask id={`${uid}-mask`} maskContentUnits="objectBoundingBox">
                  <rect
                    width="1"
                    height="1"
                    fill={`url(#${uid}-mask-gradient)`}
                  />
                </mask>

                {/* Area */}
                <AreaClosed
                  data={data}
                  x={(d) => xScale(d.date)}
                  y={(d) => yScale(s.valueAccessor(d) ?? 0)}
                  yScale={yScale}
                  curve={curveMonotoneX}
                >
                  {({ path }) => {
                    return (
                      <motion.path
                        initial={{ d: path(zeroedData) || "", opacity: 0 }}
                        animate={{ d: path(data) || "", opacity: 1 }}
                        className={cn(
                          s.colorClassName ?? "text-[#7D53E0]",
                          seriesStyle?.lineClassName
                        )}
                        mask={`url(#${uid}-mask)`}
                        fill={seriesStyle?.areaFill ?? "currentColor"}
                      />
                    );
                  }}
                </AreaClosed>

                {/* Line */}
                <Area
                  data={data}
                  x={(d) => xScale(d.date)}
                  y={(d) => yScale(s.valueAccessor(d) ?? 0)}
                  curve={curveMonotoneX}
                >
                  {({ path }) => (
                    <motion.path
                      initial={{ d: path(zeroedData) || "" }}
                      animate={{ d: path(data) || "" }}
                      className={cn(
                        s.colorClassName ?? "text-[#7D53E0]",
                        seriesStyle?.lineClassName
                      )}
                      stroke={seriesStyle?.lineStroke ?? "currentColor"}
                      strokeOpacity={0.8}
                      strokeWidth={2}
                      fill="transparent"
                    />
                  )}
                </Area>

                {/* Latest value circle */}
                {showLatestValueCircle && !tooltipData && (
                  <Circle
                    cx={xScale(data.at(-1)!.date)}
                    cy={yScale(s.valueAccessor(data.at(-1)!))}
                    r={4}
                    className={cn(
                      s.colorClassName ?? "text-[#7D53E0]",
                      seriesStyle?.lineClassName
                    )}
                    fill="currentColor"
                  />
                )}
              </motion.g>
            );
          })}
      </AnimatePresence>
    </Group>
  );
}

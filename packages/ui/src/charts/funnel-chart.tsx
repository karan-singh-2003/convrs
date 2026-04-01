import { cn, currencyFormatter, nFormatter } from "@repo/utils";
import { curveBasis } from "@visx/curve";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { Area } from "@visx/shape";
import { Text } from "@visx/text";
import { motion } from "framer-motion";
import { Fragment, useMemo, useRef, useState } from "react";
import { useMediaQuery } from "../hooks";

// ─── Color registry ─────────────────────────────────────────────────────────

export const FUNNEL_COLORS = [
  "blue", "purple", "teal", "amber", "rose", "green", "indigo", "pink",
] as const;

export type FunnelColor = (typeof FUNNEL_COLORS)[number];

const colorClassMap: Record<FunnelColor, string> = {
  blue:   "text-blue-500",
  purple: "text-purple-500",
  teal:   "text-teal-500",
  amber:  "text-amber-500",
  rose:   "text-rose-500",
  green:  "text-green-500",
  indigo: "text-indigo-500",
  pink:   "text-pink-500",
};

export function getColorClass(color?: FunnelColor | string, index?: number): string {
  if (color && color in colorClassMap) return colorClassMap[color as FunnelColor];
  if (index !== undefined) return colorClassMap[FUNNEL_COLORS[index % FUNNEL_COLORS.length]];
  return colorClassMap.blue;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type FunnelStep = {
  id: string;
  label: string;
  value?: number;           // defaults to 0 when omitted
  additionalValue?: number;
  color?: FunnelColor | string;
  colorClassName?: string;  // takes precedence over color
};

type NormalizedStep = Required<Pick<FunnelStep, "id" | "label" | "value">> & {
  additionalValue?: number;
  colorClassName: string;
};

type FunnelChartProps = {
  steps: FunnelStep[];
  persistentPercentages?: boolean;
  tooltips?: boolean;
  defaultTooltipStepId?: string;
  chartPadding?: number;
  maxSteps?: number;        // hard cap, default 8
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const layers = [
  { opacity: 1,    padding: 0  },
  { opacity: 0.3,  padding: 8  },
  { opacity: 0.15, padding: 16 },
];
const maxLayerPadding = 16;

const formatPercentage = (value: number) =>
  value > 0 && value < 0.01
    ? "< 0.01"
    : nFormatter(value, { digits: 2 });

const interpolate = (from: number, to: number) => [
  { x: 0,   y: from },
  { x: 0.3, y: from },
  { x: 0.5, y: (from + to) / 2 },
  { x: 0.7, y: to },
  { x: 1,   y: to },
];

// ─── Public component ─────────────────────────────────────────────────────────

export function FunnelChart(props: FunnelChartProps) {
  return (
    <div className="size-full">
      <ParentSize className="relative">
        {({ width, height }) =>
          width && height ? (
            <FunnelChartInner {...props} width={width} height={height} />
          ) : null
        }
      </ParentSize>
    </div>
  );
}

// ─── Inner component ──────────────────────────────────────────────────────────

function FunnelChartInner({
  width,
  height,
  steps: rawSteps,
  persistentPercentages = true,
  tooltips = true,
  defaultTooltipStepId,
  chartPadding = 40,
  maxSteps = 8,
}: { width: number; height: number } & FunnelChartProps) {
  const { isMobile } = useMediaQuery();

  // Normalize: cap, default value=0, resolve color
  const steps: NormalizedStep[] = useMemo(
    () =>
      rawSteps.slice(0, maxSteps).map((s, idx) => ({
        id:             s.id,
        label:          s.label,
        value:          s.value ?? 0,
        additionalValue: s.additionalValue,
        colorClassName: s.colorClassName ?? getColorClass(s.color, idx),
      })),
    [rawSteps, maxSteps],
  );

  const [tooltip, setTooltip] = useState<string | null>(
    defaultTooltipStepId ?? null,
  );
  const tooltipStep = steps.find(({ id }) => id === tooltip);

  const data = useMemo(
    () =>
      Object.fromEntries(
        steps.map(({ id, value }, idx) => [
          id,
          interpolate(value, steps[idx + 1]?.value ?? steps[steps.length - 1].value),
        ]),
      ),
    [steps],
  );

  const zeroData = useMemo(() => interpolate(0, 0), []);

  const maxValue = useMemo(
    () => Math.max(...steps.map((s) => s.value), 1), // avoid div-by-zero
    [steps],
  );

  const xScale = scaleLinear({ domain: [0, steps.length], range: [0, width] });
  const yScale = scaleLinear({
    domain: [maxValue, -maxValue],
    range: [
      height - maxLayerPadding - chartPadding,
      maxLayerPadding + chartPadding,
    ],
  });

  return (
    <div className="relative">
      <svg width={width} height={height}>
        {steps.map(({ id, value, colorClassName }, idx) => {
          const stepCenterX = (xScale(idx) + xScale(idx + 1)) / 2;
          return (
            <Fragment key={id}>
              {tooltips && (
                <rect
                  x={xScale(idx)}
                  y={0}
                  width={width / steps.length}
                  height={height}
                  className="fill-transparent transition-colors hover:fill-blue-600/5"
                  onPointerEnter={() => setTooltip(id)}
                  onPointerDown={() => setTooltip(id)}
                  onPointerLeave={() =>
                    !isMobile && setTooltip(defaultTooltipStepId ?? null)
                  }
                />
              )}

              <line
                x1={xScale(idx)} y1={0}
                x2={xScale(idx)} y2={height}
                className="stroke-black/5 sm:stroke-black/10"
              />

              {/* Step label */}
              <text
                x={stepCenterX}
                y={height - 8}
                textAnchor="middle"
                className="fill-neutral-400 font-display text-[14px] font-medium select-none"
                fontSize={11}
              >
                {steps[idx].label}
              </text>

              {layers.map(({ opacity, padding }) => (
                <Area
                  key={`${id}-${opacity}-${padding}`}
                  data={data[id]}
                  curve={curveBasis}
                  x={(d) => xScale(idx + d.x)}
                  y0={(d) => yScale(-d.y) - padding}
                  y1={(d) => yScale(d.y) + padding}
                >
                  {({ path }) => (
                    <motion.path
                      initial={{ d: path(zeroData) || "", opacity: 0 }}
                      animate={{ d: path(data[id]) || "", opacity }}
                      className={cn(colorClassName, "pointer-events-none")}
                      fill="currentColor"
                    />
                  )}
                </Area>
              ))}

              {persistentPercentages && (
                <PersistentPercentage
                  x={stepCenterX}
                  y={height / 2}
                  value={formatPercentage((value / maxValue) * 100) + "%"}
                  colorClassName={colorClassName}
                />
              )}
            </Fragment>
          );
        })}
      </svg>

      {tooltipStep && (
        <div
          key={tooltipStep.id}
          className={cn(
            "pointer-events-none absolute flex items-center justify-center px-1 pb-4",
            persistentPercentages
              ? "animate-slide-up-fade top-16 sm:top-12"
              : "animate-fade-in top-1/2 -translate-y-1/2",
          )}
          style={{
            left: xScale(steps.findIndex(({ id }) => id === tooltipStep.id)),
            width: width / steps.length,
          }}
        >
          <div className="rounded-2xl border border-neutral-200 bg-white text-base shadow-sm">
            <p className="border-b font-default border-neutral-200 px-3 py-2 text-sm text-neutral-900 sm:px-4 sm:py-3">
              {tooltipStep.label}
            </p>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-2 px-3 py-2 text-sm sm:px-4 sm:py-3">
              <p className="whitespace-nowrap capitalize font-default text-neutral-600">
                {formatPercentage((tooltipStep.value / maxValue) * 100) + "%"}
              </p>
              <p className="whitespace-nowrap font-medium text-neutral-900">
                {nFormatter(tooltipStep.value, { full: true })}
                {tooltipStep.additionalValue !== undefined && (
                  <span className="text-neutral-500">
                    {" "}({currencyFormatter(tooltipStep.additionalValue)})
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Persistent percentage pill ───────────────────────────────────────────────

function PersistentPercentage({
  x, y, value, colorClassName,
}: {
  x: number; y: number; value: string; colorClassName: string;
}) {
  const textRef = useRef<SVGTextElement>(null);
  const textWidth = textRef.current?.getComputedTextLength() ?? 0;
  const pillWidth = textWidth + 28;

  return (
    <g>
      <rect x={x - pillWidth / 2} width={pillWidth} y={y - 14} height={28} rx={14} fill="white" />
      <Text
        innerTextRef={textRef}
        x={x} y={y}
        textAnchor="middle" verticalAnchor="middle"
        fill="currentColor" fontSize={14}
        className={cn("pointer-events-none select-none font-medium brightness-50", colorClassName)}
      >
        {value}
      </Text>
    </g>
  );
}
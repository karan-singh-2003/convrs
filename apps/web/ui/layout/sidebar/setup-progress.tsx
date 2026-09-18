"use client";

import { useState } from "react";
import { Popover, Progress } from "@repo/ui";
import { Check } from "lucide-react";
import { cn } from "@repo/utils";
import { useSetupProgress } from "@/lib/swr/use-setup-progress";

// Compact circular indicator, sized to sit comfortably next to the ~22-25px
// avatar in UserDropdown.
const SIZE = 31;
const STROKE = 2;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * "Finish setting up Convrs" — a circular step-progress indicator that sits
 * immediately left of the user avatar (see main-nav.tsx). Clicking it opens
 * the same checklist that used to live as an inline dismissible card on the
 * workspace overview page; the step data/logic itself lives in
 * `useSetupProgress` (lib/swr/use-setup-progress.tsx) so this component and
 * anything else that needs it never fall out of sync.
 */
export function SetupProgress() {
  const [openPopover, setOpenPopover] = useState(false);
  const { steps, completedSteps } = useSetupProgress();

  // No workspace in scope (e.g. account pages, or before it's loaded) —
  // nothing meaningful to show.
  if (steps.length === 0) return null;

  const progress = completedSteps / steps.length;
  const activeIndex = steps.findIndex((s) => !s.completed);

  return (
    <Popover
      align="end"
      openPopover={openPopover}
      setOpenPopover={setOpenPopover}
      popoverContentClassName="w-[calc(100vw-2rem)] rounded-2xl max-w-[320px] sm:w-80 sm:max-w-none"
      content={
        <div className="w-full px-3 pb-4 pt-2.5">
          <h2 className="text-[14px] font-medium text-content-default">
            Finish setting up Convrs
          </h2>
          <p className="mt-0 text-[13px] font-poppins text-content-subtle">
            {completedSteps}/{steps.length} completed
          </p>

          <Progress value={progress * 100} className="mt-3 h-1.5" />

          <div className="mt-4 space-y-3">
            {steps.map((step, index) => {
              const active = !step.completed && index === activeIndex;

              return (
                <div key={step.title} className="flex gap-3">
                  {step.completed ? (
                    <div className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-neutral-700 text-white">
                      <Check size={10} strokeWidth={3.5} />
                    </div>
                  ) : active ? (
                    <div className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border border-dashed border-border-subtle" />
                  ) : (
                    <div className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border border-border-subtle bg-bg-card" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-content-default">
                      {step.title}
                    </p>

                    {step.description && (
                      <p className="mt-0.5 text-[12.5px] leading-5 text-content-subtle">
                        {step.description}
                      </p>
                    )}

                    {step.action && (
                      <div className="mt-1 text-[12px] font-medium text-content-default underline">
                        {step.action}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      }
    >
      <button
        type="button"
        onClick={() => setOpenPopover((o) => !o)}
        aria-label={`Setup progress: ${completedSteps} of ${steps.length} steps completed`}
        className={cn(
          "group relative flex shrink-0 items-center justify-center rounded-full outline-none transition-colors duration-150",
          "hover:bg-bg-emphasis active:bg-bg-default data-[state=open]:bg-bg-default",
          "focus-visible:ring-2 focus-visible:ring-border-default"
        )}
        style={{ width: SIZE, height: SIZE }}
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-90"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            className="text-border-subtle"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            className="text-content-default transition-[stroke-dashoffset] duration-300 ease-out"
          />
        </svg>

        <span className="absolute inset-0 flex items-center justify-center font-display text-[11px] font-semibold leading-none text-content-default">
          {completedSteps}/{steps.length}
        </span>
      </button>
    </Popover>
  );
}

"use client";

import { cn } from "@repo/utils";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Dispatch, ReactNode, SetStateAction, useMemo } from "react";
import { Tooltip } from "./tooltip";

export function Switch({
  fn,
  id,
  trackDimensions,
  thumbDimensions,
  thumbTranslate = "translate-x-4",
  thumbIcon,
  checked = true,
  loading = false,
  disabled = false,
  disabledTooltip,
}: {
  fn?: Dispatch<SetStateAction<boolean>> | ((checked: boolean) => void);
  id?: string;
  trackDimensions?: string;
  thumbDimensions?: string;
  thumbTranslate?: string;
  thumbIcon?: ReactNode;
  checked?: boolean;
  loading?: boolean;
  disabled?: boolean;
  disabledTooltip?: string | ReactNode;
}) {
  const switchDisabled = useMemo(() => {
    return disabledTooltip ? true : disabled || loading;
  }, [disabledTooltip, disabled, loading]);

  const switchRoot = (
    <SwitchPrimitive.Root
      checked={loading ? false : checked}
      name="switch"
      id={id}
      {...(fn && { onCheckedChange: fn })}
      disabled={switchDisabled}
     className={cn(
  "relative inline-flex h-4 w-8 items-center flex-shrink-0 cursor-pointer rounded-full border border-border-default transition-colors duration-200 ease-in-out",

  // Theme-aware colors. The track always carries a visible border-default
  // edge (not border-transparent) so the unchecked pill reads as a distinct
  // shape instead of blending into a bg-bg-card surface it's almost always
  // placed on — border-default on bg-card is the same pairing select.tsx
  // already uses for the same reason.
  "data-[state=checked]:bg-bg-inverted",
  "data-[state=unchecked]:bg-bg-emphasis",

  // Focus
  "focus:outline-none focus-visible:ring-4 focus-visible:ring-border-subtle",

  // Disabled
  "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",

  trackDimensions
)}
    >
      <SwitchPrimitive.Thumb
       className={cn(
  // bg-content-default (not bg-bg-card, which is the same value as the
  // card surface the Switch usually sits on and made the thumb disappear)
  // — this is the same token this design system already uses elsewhere as
  // a solid toggle-indicator fill (see billing/page.tsx's
  // TOGGLE_INDICATOR_CLASS). Checked state swaps to content-inverted, the
  // token already paired with bg-inverted everywhere else (button.tsx's
  // primary variant), for maximum contrast against the checked track.
  "pointer-events-none h-4 w-4 items-center translate-x-4 rounded-full bg-content-default shadow-sm transition-transform duration-200 ease-in-out",

  "data-[state=unchecked]:translate-x-0.5",
  "data-[state=checked]:bg-content-inverted",
  `data-[state=checked]:${thumbTranslate}`,

  thumbDimensions,
  thumbTranslate
)}
      >
        {thumbIcon}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );

  if (disabledTooltip) {
    return (
      <Tooltip content={disabledTooltip}>
        <div className="inline-block leading-none">{switchRoot}</div>
      </Tooltip>
    );
  }

  return switchRoot;
}
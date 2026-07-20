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
  thumbTranslate,
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
  "relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out",

  // Theme-aware colors
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
  "pointer-events-none h-3 w-3 translate-x-4 rounded-full bg-bg-card shadow-sm transition-transform duration-200 ease-in-out",

  "data-[state=unchecked]:translate-x-0",
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
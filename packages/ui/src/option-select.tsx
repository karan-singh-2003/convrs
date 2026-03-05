"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@repo/utils";
import { Check, ChevronDown } from "lucide-react";
import * as React from "react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** URL to a logo image shown alongside the label */
  logo?: string;
  /** Arbitrary React node shown as an icon when no logo URL is provided */
  icon?: React.ReactNode;
};

export type OptionSelectProps = {
  /** List of options to render */
  options: SelectOption[];
  /** Currently selected value */
  value?: string;
  /** Called with the new value when the user selects an option */
  onValueChange: (value: string) => void;
  /** Placeholder text shown when nothing is selected */
  placeholder?: string;
  /** Extra classes applied to the trigger button */
  className?: string;
  /** Disable the entire select */
  disabled?: boolean;
};

export function OptionSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select an option",
  className,
  disabled,
}: OptionSelectProps) {
  const selected = options.find((o) => o.value === value);

  return (
    <SelectPrimitive.Root
      value={value ?? ""}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-none border border-neutral-200 bg-white px-3 py-2 font-display text-sm focus:border-black focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.logo && (
            <img
              src={selected.logo}
              alt={selected.label}
              className="h-4 w-4 shrink-0 object-contain"
            />
          )}
          {!selected?.logo && selected?.icon}
          {selected ? (
            <span className="truncate text-[15px] font-display">{selected.label}</span>
          ) : (
            <span className="truncate font-display text-[15px] text-neutral-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-neutral-400" />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="relative z-50 max-h-60 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:translate-y-1"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none focus:bg-neutral-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              >
                {option.logo && (
                  <img
                    src={option.logo}
                    alt={option.label}
                    className="h-4 w-4 shrink-0 object-contain"
                  />
                )}
                {!option.logo && option.icon}

                <SelectPrimitive.ItemText asChild>
                  <span className="flex flex-1 font-display text-[15px] text-neutral-700 items-center gap-1 truncate">
                    {option.label}
                    {option.disabled && (
                      <span className="text-xs text-neutral-400">
                        (Coming Soon)
                      </span>
                    )}
                  </span>
                </SelectPrimitive.ItemText>

                <SelectPrimitive.ItemIndicator>
                  <Check className="h-4 w-4 shrink-0 text-neutral-700" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@repo/utils";
import { Check, ChevronDown } from "lucide-react";
import * as React from "react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  logo?: string;
  icon?: React.ReactNode;
};

export type OptionSelectProps = {
  options: SelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
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
      {/* Trigger */}
      <SelectPrimitive.Trigger
        className={cn(
          "h-10 w-full flex items-center justify-between rounded-sm border-[1px] border-neutral-300 bg-white px-3",
          "font-display text-sm md:text-[15px] text-neutral-700",
          "focus:outline-black/60 focus:ring-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
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
            <span className="truncate font-display text-sm md:text-[15px] text-neutral-700">
              {selected.label}
            </span>
          ) : (
            <span className="truncate font-display text-sm md:text-[15px] text-neutral-400">
              {placeholder}
            </span>
          )}
        </span>

        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-neutral-400" />
      </SelectPrimitive.Trigger>

      {/* Dropdown */}
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="relative z-50 max-h-60 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-sm border border-neutral-200 bg-white shadow-md"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-3 py-2 font-display text-sm md:text-[15px] text-neutral-700 outline-none focus:bg-neutral-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
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
                  <span className="flex flex-1 items-center gap-1 truncate">
                    {option.label}

                    {option.disabled && (
                      <span className="text-xs text-neutral-400">
                        (Coming Soon)
                      </span>
                    )}
                  </span>
                </SelectPrimitive.ItemText>

                <SelectPrimitive.ItemIndicator>
                  <Check className="h-4 w-4 shrink-0 text-neutral-600" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
"use client";

import { cn } from "@repo/utils";
import { enUS } from "date-fns/locale";
import {  useEffect, useMemo, useState } from "react";

import { Popover } from "../popover";
import { Presets } from "./presets";
import { DatePickerContext, formatDate, validatePresets } from "./shared";
import { Trigger } from "./trigger";
import { DateRange, DateRangePreset, PickerProps } from "./types";

type RangeDatePickerProps = {
  presets?: DateRangePreset[];
  presetId?: DateRangePreset["id"];
  defaultValue?: DateRange;
  value?: DateRange;
  onChange?: (dateRange?: DateRange, preset?: DateRangePreset) => void;
} & PickerProps;

const DateRangePickerInner = ({
  value,
  defaultValue,
  presetId,
  onChange,
  presets,
  disabled,
  locale = enUS,
  placeholder = "Select date range",
  hasError,
  align = "center",
  className,
  ...props
}: RangeDatePickerProps) => {


  const [open, setOpen] = useState(false);

  const [preset, setPreset] = useState<DateRangePreset | undefined>(
    presets && presetId
      ? presets.find((p) => p.id === presetId)
      : undefined
  );

  const [range, setRange] = useState<DateRange | undefined>(
    preset?.dateRange ?? value ?? defaultValue
  );

  // Sync external value
  useEffect(() => {
    setRange(value);
  }, [value]);

  // Sync preset changes
  useEffect(() => {
    const p = presets?.find((p) => p.id === presetId);
    setPreset(p);
    setRange(p?.dateRange ?? value ?? defaultValue);
  }, [presets, presetId]);

  const onPresetSelected = (preset: DateRangePreset) => {
    setPreset(preset);
    setRange(preset.dateRange);
    onChange?.(preset.dateRange, preset);
    setOpen(false);
  };

  const displayRange = useMemo(() => {
    if (!range) return null;

    return `${range.from ? formatDate(range.from, locale) : ""} - ${
      range.to ? formatDate(range.to, locale) : ""
    }`;
  }, [range, locale]);

  return (
    <DatePickerContext.Provider value={{ isOpen: open, setIsOpen: setOpen }}>
      <Popover
        align={align}
        openPopover={open}
        setOpenPopover={setOpen}
        popoverContentClassName="rounded-none"
        content={
          <div className="w-full md:w-[240px] p-2">
            {presets && presets.length > 0 && (
              <Presets
                currentPresetId={preset?.id}
                currentValue={range}
                presets={presets}
                onSelect={onPresetSelected}
              />
            )}
          </div>
        }
      >
        <Trigger
          placeholder={placeholder}
          disabled={disabled}
          className={cn("", className)}
          hasError={hasError}
          aria-required={props.required || props["aria-required"]}
          aria-invalid={props["aria-invalid"]}
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
        >
          {preset?.label ?? displayRange ?? placeholder}
        </Trigger>
      </Popover>
    </DatePickerContext.Provider>
  );
};

export function DateRangePicker({ presets, ...props }: RangeDatePickerProps) {
  if (presets) validatePresets(presets, props);

  return <DateRangePickerInner presets={presets} {...props} />;
}
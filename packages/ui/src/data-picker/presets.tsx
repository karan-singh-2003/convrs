import { cn } from "@repo/utils";
import { Command } from "cmdk";
import { Lock } from "lucide-react";
import { Tooltip } from "../tooltip";
import { useMediaQuery } from "../hooks";
import { DatePreset, DateRange, DateRangePreset, Preset } from "./types";

type PresetsProps<TPreset extends Preset, TValue> = {
  presets: TPreset[];
  onSelect: (preset: TPreset) => void;
  currentValue?: TValue;
  currentPresetId?: string;
};

const Presets = <TPreset extends Preset, TValue>({
  // Available preset configurations
  presets,
  // Event handler when a preset is selected
  onSelect,
  // Currently selected preset range value
  currentValue,
  // Currently selected preset id
  currentPresetId,
}: PresetsProps<TPreset, TValue>) => {
  const { isMobile } = useMediaQuery();
  const isDateRangePresets = (preset: any): preset is DateRangePreset =>
    "dateRange" in preset;

  const isDatePresets = (preset: any): preset is DatePreset => "date" in preset;

  const compareDates = (date1: Date, date2: Date) =>
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();

  const compareRanges = (range1: DateRange, range2: DateRange) => {
    const from1 = range1.from;
    const from2 = range2.from;

    let equalFrom = false;

    if (from1 && from2) {
      const sameFrom = compareDates(from1, from2);

      if (sameFrom) equalFrom = true;
    }

    const to1 = range1.to;
    const to2 = range2.to;

    let equalTo = false;

    if (to1 && to2) {
      const sameTo = compareDates(to1, to2);

      if (sameTo) equalTo = true;
    }

    return equalFrom && equalTo;
  };

  const matchesCurrent = (preset: TPreset) => {
    if (currentPresetId) {
      return currentPresetId === preset.id;
    }

    if (isDateRangePresets(preset)) {
      const value = currentValue as DateRange | undefined;

      return value && compareRanges(value, preset.dateRange);
    } else if (isDatePresets(preset)) {
      const value = currentValue as Date | undefined;

      return value && compareDates(value, preset.date);
    }

    return false;
  };

  return (
    <Command
      className="w-full  rounded-none focus:outline-none"
      tabIndex={0}
      autoFocus
      loop
    >
      <Command.List className="[&>*]:flex-col [&>*]:w-full [&>*]:items-start [&>*]:gap-x-2 [&>*]:gap-y-0.5 [&>*]:sm:flex-col">
        {presets.map((preset, index) => {
          return (
            <Command.Item
              key={index}
              disabled={preset.requiresUpgrade}
              onSelect={() => onSelect(preset)}
              title={preset.label}
              value={preset.id}
              className={cn(
                "group relative flex w-full cursor-pointer items-center justify-between rounded-none",
                "px-3 py-2 font-display text-[14.5px] font-medium md:text-sm text-neutral-500 outline-none transition-colors",
                "whitespace-normal break-words sm:whitespace-nowrap sm:break-normal",
                "hover:bg-neutral-100",
                "data-[selected=true]:bg-neutral-100",
                "disabled:pointer-events-none disabled:opacity-50",
                matchesCurrent(preset) && "font-medium text-neutral-600"
              )}
            >
              <span className="flex-1 pr-2">
                {isMobile && (preset as any).mobileLabel
                  ? (preset as any).mobileLabel
                  : preset.label}
              </span>
              {preset.requiresUpgrade ? (
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              ) : preset.shortcut ? null : null}
              {preset.requiresUpgrade && preset.tooltipContent && (
                <Tooltip side="bottom" content={preset.tooltipContent}>
                  <div className="absolute inset-0 cursor-not-allowed"></div>
                </Tooltip>
              )}
            </Command.Item>
          );
        })}
      </Command.List>
    </Command>
  );
};

Presets.displayName = "DatePicker.Presets";

export { Presets };

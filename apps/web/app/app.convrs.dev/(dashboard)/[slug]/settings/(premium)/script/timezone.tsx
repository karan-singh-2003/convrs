// "use client";

// import { useMemo } from "react";
// import { ChevronDown } from "lucide-react";
// import { Button, Combobox } from "@repo/ui";
// import useWorkspace from "@/lib/swr/use-workspace";
// import { toast } from "sonner";

// const DEFAULT_TIMEZONE = "UTC";

// function getOffsetMinutes(timeZone: string, date: Date) {
//     const formatter = new Intl.DateTimeFormat("en-US", {
//         timeZone,
//         timeZoneName: "longOffset",
//     });

//     const tzPart = formatter
//         .formatToParts(date)
//         .find((part) => part.type === "timeZoneName")?.value;

//     if (!tzPart) return 0;

//     const match = tzPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);

//     if (!match) return 0;

//     const [, sign, hours, minutes = "00"] = match;

//     const total = Number(hours) * 60 + Number(minutes);

//     return sign === "-" ? -total : total;
// }

// function formatOffset(offsetMinutes: number) {
//     const sign = offsetMinutes >= 0 ? "+" : "-";

//     const abs = Math.abs(offsetMinutes);

//     const hours = Math.floor(abs / 60)
//         .toString()
//         .padStart(2, "0");

//     const minutes = (abs % 60).toString().padStart(2, "0");

//     return `UTC${sign}${hours}:${minutes}`;
// }

// function getTimezoneOptions(date: Date) {
//     const zones =
//         typeof Intl.supportedValuesOf === "function"
//             ? Intl.supportedValuesOf("timeZone")
//             : [DEFAULT_TIMEZONE];

//     return zones
//         .map((tz) => {
//             const offset = getOffsetMinutes(tz, date);

//             return {
//                 value: tz,
//                 label: `(${formatOffset(offset)}) ${tz}`,
//                 offset,
//             };
//         })
//         .sort((a, b) => {
//             if (a.offset !== b.offset) return a.offset - b.offset;
//             return a.value.localeCompare(b.value);
//         });
// }



// export function Timezone() {
//     const { timezone } = useWorkspace();
//     console.log({ timezone })
//     const options = useMemo(() => getTimezoneOptions(new Date()), []);


//     const current =
//         options.find((t) => t.value === timezone) ??
//         options.find((t) => t.value === DEFAULT_TIMEZONE);

//     const selectedTimezone =
//         options.find((option) => option.value === timezone) ?? null;

//     const onChange = async (value: any) => {
//         setIsLoading(true);
//         // const res = await upsertWorkspace({ timezone: value.value });
//         // if (res?.data) {
//         //     setWorkspace(res?.data);
//         // }
//         setIsLoading(false);
//         toast.success("Workspace updated!");
//     };
//     return (
//         <div className="overflow-hidden rounded-xl space-y-3 border border-neutral-200 px-4 py-3 bg-white">
//             <label className="text-sm font-display font-medium text-neutral-600">
//                 Time zone
//             </label>


//             <Combobox
//                 selected={selectedTimezone}
//                 setSelected={(v) => {
//                     if (v) onChange(v);
//                 }}
//                 options={options}
//                 searchPlaceholder="Search timezone..."
//                 placeholder="Select timezone"
//                 trigger={
//                     <button
//                         type="button"
//                         className="flex w-full items-center justify-between font-display rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-[14.5px] text-neutral-500 transition hover:bg-neutral-200"
//                     >
//                         <span className="truncate">
//                             {current?.label ?? "Select timezone"}
//                         </span>

//                         <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500" />
//                     </button>
//                 }
//             />
//             <div className="flex items-end w-full justify-end">
//                 <Button text="save" variant="secondary" className="w-fit h-fit py-1 font-display text-sm" />
//             </div>
//         </div>
//     );
// }

// function setIsLoading(arg0: boolean) {
//     throw new Error("Function not implemented.");
// }
"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button, Combobox } from "@repo/ui";
import useWorkspace from "@/lib/swr/use-workspace";
import { toast } from "sonner";

const DEFAULT_TIMEZONE = "UTC";

function getOffsetMinutes(timeZone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  });
  const tzPart = formatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  if (!tzPart) return 0;
  const match = tzPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const [, sign, hours, minutes = "00"] = match;
  const total = Number(hours) * 60 + Number(minutes);
  return sign === "-" ? -total : total;
}

function formatOffset(offsetMinutes: number) {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60).toString().padStart(2, "0");
  const minutes = (abs % 60).toString().padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}

function getTimezoneOptions(date: Date) {
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [DEFAULT_TIMEZONE];

  return zones
    .map((tz) => {
      const offset = getOffsetMinutes(tz, date);
      return { value: tz, label: `(${formatOffset(offset)}) ${tz}`, offset };
    })
    .sort((a, b) => (a.offset !== b.offset ? a.offset - b.offset : a.value.localeCompare(b.value)));
}

export function Timezone() {
  const { id: workspaceId, timezone, mutate } = useWorkspace();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingValue, setPendingValue] = useState<string | null>(null);

  const options = useMemo(() => getTimezoneOptions(new Date()), []);

  // timezone should be set at workspace creation (browser-detected) and
  // persisted server-side, so this fallback is just a safeguard for old/edge rows
  const effectiveTimezone = timezone || DEFAULT_TIMEZONE;

  const selectedValue = pendingValue ?? effectiveTimezone;
  const current = options.find((t) => t.value === selectedValue) ?? null;

  const onChange = (option: { value: string } | null) => {
    if (!option) return;
    setPendingValue(option.value);
  };

  const onSave = async () => {
    if (!pendingValue || !workspaceId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: pendingValue }),
      });
      if (!res.ok) throw new Error("Failed to update timezone");
      await mutate?.();
      toast.success("Workspace updated!");
    } catch (err) {
      toast.error("Failed to update timezone");
    } finally {
      setIsLoading(false);
    }
  };

  console.log("options",options)

  return (
    <div className="overflow-hidden rounded-xl space-y-3 border border-neutral-200 px-4 py-3 bg-white">
      <label className="text-sm font-display font-medium text-neutral-600">Time zone</label>

      <Combobox
        selected={current}
        setSelected={onChange}
        options={options}
        searchPlaceholder="Search timezone..."
        placeholder="Select timezone"
        trigger={
          <button
            type="button"
            className="flex w-full items-center justify-between font-display rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2 text-[14.5px] text-neutral-500 transition hover:bg-neutral-200"
          >
            <span className="truncate">{current?.label ?? "Select timezone"}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500" />
          </button>
        }
      />
      <div className="flex items-end w-full justify-end">
        <Button
          text="save"
          variant="secondary"
          onClick={onSave}
          loading={isLoading}
          disabled={!pendingValue || pendingValue === timezone}
          className="w-fit h-fit py-1 font-display text-sm"
        />
      </div>
    </div>
  );
}
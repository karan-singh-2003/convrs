// Timezone option helpers, matching the combobox pattern used in
// app/app.convrs.dev/(dashboard)/[slug]/settings/script/timezone.tsx
// Kept framework-agnostic so it can be reused from the onboarding flow.

export const DEFAULT_TIMEZONE = "UTC";

export type TimezoneOption = {
  value: string;
  label: string;
  offset: number;
};

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
  const hours = Math.floor(abs / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (abs % 60).toString().padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}

export function getTimezoneOptions(date: Date): TimezoneOption[] {
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [DEFAULT_TIMEZONE];

  return zones
    .map((tz) => {
      const offset = getOffsetMinutes(tz, date);
      return { value: tz, label: `(${formatOffset(offset)}) ${tz}`, offset };
    })
    .sort((a, b) =>
      a.offset !== b.offset
        ? a.offset - b.offset
        : a.value.localeCompare(b.value)
    );
}

/** Browser-detected IANA timezone, with a safe fallback. */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

import { TZDate } from "@date-fns/tz";

export const formatUTCDateTimeClickhouse = (date: Date | TZDate) => {
  const internal = (date as any).internal;
  const utcMs = internal instanceof Date ? internal.getTime() : date.getTime();

  return new Date(utcMs)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");
};
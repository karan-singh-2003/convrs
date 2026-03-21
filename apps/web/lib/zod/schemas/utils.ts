import { parseDateTime } from "@repo/utils";
import * as z from "zod/v4";

export const parseDateSchema = z
  .string()
  .transform((v) => parseDateTime(v))
  .refine((v) => !!v, { message: "Invalid date" });

  const coerceToNumber = (n: unknown) =>
  typeof n === "bigint" || typeof n === "string" ? Number(n) : n;

/** Accepts number (before migration) or bigint (after), outputs number. */
export const centsSchema = z.preprocess(coerceToNumber, z.number());

export const centsSchemaWithDefault = z.preprocess(
  coerceToNumber,
  z.number().default(0)
);

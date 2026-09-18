import * as z from "zod/v4";
import { apiError } from "./response";

/** Thrown by v1 query/param validation helpers for a 400 response. */
export class InvalidRequestError extends Error {}

export function toV1ErrorResponse(err: unknown) {
  if (err instanceof InvalidRequestError) {
    return apiError("bad_request", err.message);
  }

  if (err instanceof z.ZodError) {
    const first = err.issues[0];
    const path = first?.path?.length ? first.path.join(".") : undefined;
    return apiError(
      "bad_request",
      path ? `${path}: ${first.message}` : (first?.message ?? "Invalid request.")
    );
  }

  console.error("[api/v1] unhandled error", err);
  return apiError(
    "internal_server_error",
    "Something went wrong processing this request."
  );
}

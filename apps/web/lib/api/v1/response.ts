import { NextResponse } from "next/server";
import { ErrorCodes } from "@/lib/api/error-codes";

type KnownErrorCode = keyof typeof ErrorCodes;

/**
 * Single response envelope for all /api/v1/* routes: `{ data }` on success,
 * `{ error: { code, message } }` on failure. Reuses the existing
 * lib/api/error-codes.ts code set so the public API's error vocabulary
 * matches the rest of the app rather than inventing a second one.
 */
export function apiSuccess(
  data: unknown,
  init?: { status?: number; headers?: HeadersInit }
) {
  return NextResponse.json(
    { data },
    { status: init?.status ?? 200, headers: init?.headers }
  );
}

export function apiPaginated(
  data: unknown[],
  pagination: { page: number; limit: number; hasMore: boolean },
  init?: { headers?: HeadersInit }
) {
  return NextResponse.json(
    { data, pagination },
    { status: 200, headers: init?.headers }
  );
}

export function apiError(
  code: KnownErrorCode,
  message: string,
  headers?: HeadersInit
) {
  return NextResponse.json(
    { error: { code, message } },
    { status: ErrorCodes[code], headers }
  );
}

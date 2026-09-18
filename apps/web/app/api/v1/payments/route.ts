import { withApiToken } from "@/lib/auth";
import { listWorkspacePayments } from "@/lib/api/payments/query-payments";
import { apiPaginated } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";
import { checkWebsiteScope } from "@/lib/api/v1/website";
import { v1PaginationFields } from "@/lib/api/v1/query";
import * as z from "zod/v4";

export const querySchema = v1PaginationFields.extend({
  websiteId: z.string().optional(),
});

// GET /api/v1/payments — a redacted list of Payment rows: amount, currency,
// provider, isRecurring, billingInterval, createdAt, attributionStatus,
// customerId. Deliberately excludes externalSessionId/externalPaymentId/
// externalEventId (provider-side identifiers) and customerEmail (PII) — see
// lib/api/payments/query-payments.ts.
export const GET = withApiToken(
  async ({ workspace, searchParams }) => {
    try {
      const query = querySchema.parse(searchParams);

      const scopeError = checkWebsiteScope(workspace, query.websiteId);
      if (scopeError) return scopeError;

      const { rows, hasMore } = await listWorkspacePayments(workspace, {
        page: query.page,
        limit: query.limit,
      });

      return apiPaginated(rows, {
        page: query.page,
        limit: query.limit,
        hasMore,
      });
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "payments.read" }
);

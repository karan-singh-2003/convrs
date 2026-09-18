import * as z from "zod/v4";
import { withApiToken } from "@/lib/auth";
import { listWorkspaceCustomers } from "@/lib/api/customers/query-customers";
import { toPublicCustomer } from "@/lib/api/v1/customer";
import { apiPaginated } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";
import { checkWebsiteScope } from "@/lib/api/v1/website";
import { MAX_PAGE_LIMIT, DEFAULT_PAGE_LIMIT } from "@/lib/api/v1/query";

export const querySchema = z.object({
  websiteId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

// GET /api/v1/customers — reuses listWorkspaceCustomers() exactly as the
// dashboard's own /customers route does. Note: that function takes a flat
// `limit` (capped internally at 500), not true page/cursor pagination — so
// `hasMore` here is a `returned.length === limit` heuristic, not an exact
// count. Cursor pagination would require changing the underlying query.
//
// Response is redacted via toPublicCustomer() — email/stripeCustomerId are
// stripped before this leaves the API, since analytics.read is a broader,
// more commonly-granted scope than payments.read and shouldn't reveal a
// payment-provider identifier or raw contact PII (see lib/api/v1/customer.ts).
export const GET = withApiToken(
  async ({ workspace, searchParams }) => {
    try {
      const query = querySchema.parse(searchParams);

      const scopeError = checkWebsiteScope(workspace, query.websiteId);
      if (scopeError) return scopeError;

      const customers = await listWorkspaceCustomers(workspace, query.limit);

      return apiPaginated(customers.map(toPublicCustomer), {
        page: 1,
        limit: query.limit,
        hasMore: customers.length === query.limit,
      });
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "analytics.read" }
);

import { withApiToken } from "@/lib/auth";
import { getWorkspaceCustomerById } from "@/lib/api/customers/query-customers";
import { toPublicCustomer } from "@/lib/api/v1/customer";
import { apiSuccess, apiError } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";

// GET /api/v1/customers/:customerId — getWorkspaceCustomerById() already
// filters by `workspaceId: workspace.id`, so a customer ID belonging to
// another workspace resolves to null (404), never a cross-tenant read —
// that's the IDOR boundary for this route, enforced inside the query itself.
//
// Response is redacted via toPublicCustomer() — see lib/api/v1/customer.ts.
export const GET = withApiToken(
  async ({ workspace, params }) => {
    try {
      const customer = await getWorkspaceCustomerById(
        workspace,
        params.customerId
      );

      if (!customer) {
        return apiError("not_found", "Customer not found.");
      }

      return apiSuccess(toPublicCustomer(customer));
    } catch (err) {
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "analytics.read" }
);

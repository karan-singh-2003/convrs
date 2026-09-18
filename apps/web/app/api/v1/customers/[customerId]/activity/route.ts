import { withApiToken } from "@/lib/auth";
import { getCustomerActivity } from "@/lib/analytics/get-customer-activity";
import { apiSuccess, apiError } from "@/lib/api/v1/response";
import { toV1ErrorResponse } from "@/lib/api/v1/errors";

// GET /api/v1/customers/:customerId/activity — the customer's event
// history, grouped by day. Reuses getCustomerActivity() exactly, which
// itself is now a thin wrapper around getVisitorActivity() (visitor_id ->
// Tinybird v1_customer_activity) so it works for anonymous customers (whose
// externalId is their visitor_id) as well as identified ones.
export const GET = withApiToken(
  async ({ workspace, params }) => {
    try {
      const activity = await getCustomerActivity({
        workspaceId: workspace.id,
        customerId: params.customerId,
      });

      return apiSuccess(activity);
    } catch (err) {
      if (err instanceof Error && err.message === "Customer not found") {
        return apiError("not_found", "Customer not found.");
      }
      return toV1ErrorResponse(err);
    }
  },
  { requiredScope: "analytics.read" }
);

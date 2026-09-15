import { NextResponse } from "next/server";
import { withSession } from "@/lib/auth/session";
import { resumeSubscription, BillingError } from "@/lib/billing/subscription-service";
import { mapDodoError } from "@/lib/billing/dodo-checkout";

// POST /api/subscriptions/[id]/resume — revoke a scheduled cancellation
export const POST = withSession<{ id: string }>(async ({ params, session }) => {
  try {
    await resumeSubscription(params.id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.httpStatus });
    }
    const mapped = mapDodoError(err);
    console.error("[POST /api/subscriptions/[id]/resume]", err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
});

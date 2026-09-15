import { NextResponse } from "next/server";
import { withSession } from "@/lib/auth/session";
import { getBillingContext } from "@/lib/billing/subscription-service";

// GET /api/billing/context — everything the "Add Website" / billing UI needs
// in one call (user-scoped, not workspace-scoped).
export const GET = withSession(async ({ session }) => {
  const ctx = await getBillingContext(session.user.id);
  return NextResponse.json(ctx);
});

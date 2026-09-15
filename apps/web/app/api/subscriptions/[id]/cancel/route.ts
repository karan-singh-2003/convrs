import { NextResponse } from "next/server";
import { z } from "zod";
import { withSession } from "@/lib/auth/session";
import { cancelSubscriptionSchema } from "@/lib/zod/schemas/subscriptions";
import { cancelSubscription, BillingError } from "@/lib/billing/subscription-service";
import { mapDodoError } from "@/lib/billing/dodo-checkout";

// POST /api/subscriptions/[id]/cancel
export const POST = withSession<{ id: string }>(async ({ req, params, session }) => {
  let body: z.infer<typeof cancelSubscriptionSchema>;
  try {
    body = cancelSubscriptionSchema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await cancelSubscription({
      actorUserId: session.user.id,
      subscriptionId: params.id,
      mode: body.mode,
      acknowledgeWorkspaceIds: body.acknowledgeWorkspaceIds,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json(
        { error: err.message, code: err.code, ...err.extra },
        { status: err.httpStatus },
      );
    }
    const mapped = mapDodoError(err);
    console.error("[POST /api/subscriptions/[id]/cancel]", err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
});

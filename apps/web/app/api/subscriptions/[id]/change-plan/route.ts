import { NextResponse } from "next/server";
import { z } from "zod";
import { withSession } from "@/lib/auth/session";
import { changePlanSchema } from "@/lib/zod/schemas/subscriptions";
import { changePlan, BillingError } from "@/lib/billing/subscription-service";
import { mapDodoError } from "@/lib/billing/dodo-checkout";

// POST /api/subscriptions/[id]/change-plan
export const POST = withSession<{ id: string }>(async ({ req, params, session }) => {
  let body: z.infer<typeof changePlanSchema>;
  try {
    body = changePlanSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await changePlan({
      actorUserId: session.user.id,
      subscriptionId: params.id,
      targetFamily: body.targetFamily,
      targetTier: body.targetTier,
      targetInterval: body.targetInterval,
      keepWorkspaceId: body.keepWorkspaceId,
      acknowledgeDetachWorkspaceIds: body.acknowledgeDetachWorkspaceIds,
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
    console.error("[POST /api/subscriptions/[id]/change-plan]", err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
});

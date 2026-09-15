import { NextResponse } from "next/server";
import { z } from "zod";
import { withSession } from "@/lib/auth/session";
import { createSubscriptionSchema } from "@/lib/zod/schemas/subscriptions";
import {
  createSubscriptionCheckout,
  listUserSubscriptions,
  BillingError,
} from "@/lib/billing/subscription-service";
import { mapDodoError } from "@/lib/billing/dodo-checkout";

// GET /api/subscriptions — the caller's subscriptions
export const GET = withSession(async ({ session }) => {
  const subs = await listUserSubscriptions(session.user.id);
  return NextResponse.json(subs);
});

// POST /api/subscriptions — start a checkout for a new (or trial→paid) subscription
export const POST = withSession(async ({ req, session }) => {
  let body: z.infer<typeof createSubscriptionSchema>;
  try {
    body = createSubscriptionSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await createSubscriptionCheckout({
      actorUserId: session.user.id,
      intent: body.intent,
      tier: body.tier,
      interval: body.interval,
      targetWorkspaceId: body.targetWorkspaceId,
      consolidateStandardSubIds: body.consolidateStandardSubIds,
      onboarding: body.onboarding,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json(
        { error: err.message, code: err.code, ...err.extra },
        { status: err.httpStatus },
      );
    }
    const mapped = mapDodoError(err);
    console.error("[POST /api/subscriptions]", err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
});

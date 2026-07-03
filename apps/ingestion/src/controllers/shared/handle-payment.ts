// apps/ingestion/src/controllers/shared/handle-payment.ts
import { prisma } from "@repo/db";
import { processPayment } from "@repo/analytics";
import type { RevenueProvider } from "@repo/db/client";

export async function handlePaymentEvent(params: {
  workspaceId: string;
  provider: RevenueProvider;
  externalSessionId: string;
  externalEventId: string;
  externalPaymentId?: string | null;
  amount: number;
  currency: string;
  customerEmail?: string | null;
  visitorId?: string | null;
  sessionId?: string | null;
}) {
  const {
    workspaceId, provider, externalSessionId, externalEventId,
    externalPaymentId, amount, currency, customerEmail, visitorId, sessionId,
  } = params;

  if (!visitorId) {
    console.warn(
      `[${provider}/webhook] No visitor_id in metadata for ${externalSessionId} — storing payment without attribution`
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { projectToken: true },
  });

  if (!workspace?.projectToken) {
    console.error(`[${provider}/webhook] No projectToken for workspace ${workspaceId}`);
    return;
  }

  const workspaceOwner = await prisma.workspaceUsers.findFirst({
    where: { workspaceId, role: "owner" },
    select: { user: { select: { id: true } } },
  });

  await processPayment({
    workspaceId,
    provider,
    userId: workspaceOwner?.user?.id ?? "",
    websiteId: workspace.projectToken,
    externalSessionId,
    externalEventId,
    externalPaymentId: externalPaymentId ?? undefined,
    amount,
    currency,
    customerEmail: customerEmail ?? undefined,
    visitorId: visitorId ?? undefined,
    sessionId: sessionId ?? undefined,
  });
}
import { prisma } from "@repo/db";
import type { WorkspaceProps } from "@/lib/types";

/**
 * Deliberately redacted — never includes externalSessionId/externalPaymentId/
 * externalEventId (provider-side identifiers) or customerEmail (PII). See
 * packages/db/schema/payment.prisma for the full Payment model this reshapes.
 */
export type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  isRecurring: boolean;
  billingInterval: string | null;
  createdAt: string;
  attributionStatus: string;
  customerId: string;
};

function mapPayment(payment: {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  isRecurring: boolean;
  billingInterval: string | null;
  createdAt: Date;
  attributionStatus: string;
  customerId: string;
}): PaymentRow {
  return {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    provider: payment.provider,
    isRecurring: payment.isRecurring,
    billingInterval: payment.billingInterval,
    createdAt: payment.createdAt.toISOString(),
    attributionStatus: payment.attributionStatus,
    customerId: payment.customerId,
  };
}

export async function listWorkspacePayments(
  workspace: WorkspaceProps,
  { page = 1, limit = 100 }: { page?: number; limit?: number } = {}
): Promise<{ rows: PaymentRow[]; hasMore: boolean }> {
  const skip = (page - 1) * limit;

  const payments = await prisma.payment.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit + 1,
    select: {
      id: true,
      amount: true,
      currency: true,
      provider: true,
      isRecurring: true,
      billingInterval: true,
      createdAt: true,
      attributionStatus: true,
      customerId: true,
    },
  });

  const hasMore = payments.length > limit;
  return { rows: payments.slice(0, limit).map(mapPayment), hasMore };
}

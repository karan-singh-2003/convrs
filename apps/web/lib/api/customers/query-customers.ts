import { prisma } from "@repo/db";
import type { WorkspaceProps } from "@/lib/types";

export type CustomerRow = {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  externalId: string | null;
  stripeCustomerId: string | null;
  country: string | null;
  sales: number;
  saleAmount: number;
  firstSaleAt: string | null;
  subscriptionCanceledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toIsoString = (
  value: Date | string | null | undefined
): string | null => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
};

function mapCustomer(customer: any): CustomerRow {
  return {
    id: String(customer.id),
    name: customer.name ?? null,
    email: customer.email ?? null,
    avatar: customer.avatar ?? null,
    externalId: customer.externalId ?? null,
    stripeCustomerId: customer.stripeCustomerId ?? null,
    country: customer.country ?? null,
    sales: toNumber(customer.sales),
    saleAmount: toNumber(customer.saleAmount),
    firstSaleAt: toIsoString(customer.firstSaleAt),
    subscriptionCanceledAt: toIsoString(customer.subscriptionCanceledAt),
    createdAt: toIsoString(customer.createdAt),
    updatedAt: toIsoString(customer.updatedAt),
  };
}

export async function listWorkspaceCustomers(
  workspace: WorkspaceProps,
  limit = 100
): Promise<CustomerRow[]> {
  const customerDelegate = (prisma as any).customer;

  if (!customerDelegate) {
    return [];
  }

  const customers = await customerDelegate.findMany({
    where: {
      OR: [
        { workspaceId: workspace.id },
        ...(workspace.projectToken
          ? [{ projectConnectId: workspace.projectToken }]
          : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(1, Math.min(limit, 500)),
  });

  return customers.map(mapCustomer);
}

export async function getWorkspaceCustomerById(
  workspace: WorkspaceProps,
  customerId: string
): Promise<CustomerRow | null> {
  const customerDelegate = (prisma as any).customer;

  if (!customerDelegate) {
    return null;
  }

  const customer = await customerDelegate.findFirst({
    where: {
      id: customerId,
      OR: [
        { workspaceId: workspace.id },
        ...(workspace.projectToken
          ? [{ projectConnectId: workspace.projectToken }]
          : []),
      ],
    },
  });

  return customer ? mapCustomer(customer) : null;
}

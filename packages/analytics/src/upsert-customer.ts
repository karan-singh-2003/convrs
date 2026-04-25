import {prisma} from "@repo/db"

export async function upsertCustomer({
  workspaceId,
  traits,
  geo,
}: {
  workspaceId: string;
  traits?: any;
  geo?: string;
}) {
  if (!workspaceId) return null;

  const email = traits?.email ?? null;
  const externalId = traits?.user_id ?? null;
  const name = traits?.name ?? null;

  // 🔥 Priority: externalId → email → visitor fallback
  let whereClause;

  if (externalId) {
    whereClause = {
      workspaceId_externalId: {
        workspaceId,
        externalId,
      },
    };
  } else if (email) {
    whereClause = {
      workspaceId_email: {
        workspaceId,
        email,
      },
    };
  } else {
    return null; // don’t create anonymous customers
  }

  const customer = await prisma.customer.upsert({
    where: whereClause as any,
    update: {
      name,
      email,
      country: geo ?? undefined,
      updatedAt: new Date(),
    },
    create: {
      workspaceId,
      externalId,
      email,
      name,
      country: geo ?? undefined,
    },
  });

  return customer;
}
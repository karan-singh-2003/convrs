import { prisma } from "@repo/db";
import { generateAnonymousName } from "./anonymous-names";

export async function upsertAnonymousCustomer({
  workspaceId,
  visitorId,
  country,
  device,
  browser,
}: {
  workspaceId: string;
  visitorId: string;
  country?: string;
  device?: string;
  browser?: string;
}) {
  // Use findFirst + create instead of upsert to avoid the
  // @@unique([workspaceId, externalId]) constraint needing externalId non-null
  const existing = await prisma.customer.findFirst({
    where: { workspaceId, externalId: visitorId },
  });

  if (existing) {
    if ((device && !existing.device) || (browser && !existing.browser)) {
      return prisma.customer.update({
        where: { id: existing.id },
        data: {
          device: device || existing.device,
          browser: browser || existing.browser,
        },
      });
    }
    return existing; // already seen this visitor, no-op
  }

  return prisma.customer.create({
    data: {
      workspaceId,
      externalId: visitorId, // visitor_id is the stable anonymous key
      name: generateAnonymousName(visitorId),
      country: country || null,
      device: device || null,
      browser: browser || null,
    },
  });
}

export async function upsertCustomer({
  workspaceId,
  traits,
  geo,
  visitorId,
  device,
  browser,
}: {
  workspaceId: string;
  traits: Record<string, any>;
  geo?: string;
  visitorId?: string;
  device?: string;
  browser?: string;
}) {
  const externalId = traits.user_id ?? traits.userId ?? traits.email ?? null;

  const data = {
    name: traits.name ?? undefined,
    email: traits.email ?? undefined,
    avatar: traits.image ?? undefined,
    country: geo || undefined,
    device: device || undefined,
    browser: browser || undefined,
    updatedAt: new Date(),
  };

  // If anonymous record exists for this visitor, upgrade it in place
  if (visitorId) {
    const anon = await prisma.customer.findFirst({
      where: { workspaceId, externalId: visitorId },
    });
    if (anon) {
      return prisma.customer.update({
        where: { id: anon.id },
        data: {
          ...data,
          externalId: externalId ?? visitorId, // promote to real ID if available
        },
      });
    }
  }

  // Standard upsert by real externalId
  if (externalId) {
    return prisma.customer.upsert({
      where: { workspaceId_externalId: { workspaceId, externalId } },
      create: { workspaceId, externalId, ...data },
      update: data,
    });
  }

  return prisma.customer.create({
    data: { workspaceId, ...data },
  });
}

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

  try {
    return await prisma.customer.create({
      data: {
        workspaceId,
        externalId: visitorId, // visitor_id is the stable anonymous key
        name: generateAnonymousName(visitorId),
        country: country || null,
        device: device || null,
        browser: browser || null,
      },
    });
  } catch (error) {
    // Two concurrent first pageviews for the same visitor both miss the
    // findFirst above; the loser hits @@unique([workspaceId, externalId]).
    // Converge on the row the winner created instead of failing the event.
    if (!isUniqueViolation(error)) throw error;
    const winner = await prisma.customer.findFirst({
      where: { workspaceId, externalId: visitorId },
    });
    if (!winner) throw error;
    return winner;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
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
      try {
        return await prisma.customer.update({
          where: { id: anon.id },
          data: {
            ...data,
            externalId: externalId ?? visitorId, // promote to real ID if available
          },
        });
      } catch (error) {
        // The real ID already belongs to another Customer (same user seen
        // on another device/browser): update that one instead of failing.
        if (!isUniqueViolation(error) || !externalId) throw error;
      }
    }
  }

  // Standard upsert by real externalId. Concurrent upserts for a new ID can
  // both attempt the insert; the loser retries once and takes the update path.
  if (externalId) {
    const upsert = () =>
      prisma.customer.upsert({
        where: { workspaceId_externalId: { workspaceId, externalId } },
        create: { workspaceId, externalId, ...data },
        update: data,
      });
    try {
      return await upsert();
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return upsert();
    }
  }

  return prisma.customer.create({
    data: { workspaceId, ...data },
  });
}

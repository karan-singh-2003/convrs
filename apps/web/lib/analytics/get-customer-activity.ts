import { prisma } from "@repo/db";
import { tb } from "@/lib/tinybird";
import * as z from "zod/v4";

export const customerActivityPipe = tb.buildPipe({
  pipe: "v1_customer_activity",
  parameters: z.object({
    workspaceId: z.string().min(1),
    visitorId: z.string().min(1),
    limit: z.number().int().positive().optional().default(100),
  }),
  data: z.object({
    event_id: z.string(),
    timestamp: z.string(),
    event_type: z.string(),
    event_name: z.string(),
    page: z.string().nullable(),
    url: z.string().nullable(),
    referer: z.string().nullable(),
    referer_url: z.string().nullable(),
    browser: z.string(),
    device: z.string(),
    country: z.string(),
    utm_source: z.string().nullable(),
    utm_medium: z.string().nullable(),
    utm_campaign: z.string().nullable(),
    event_properties: z.string(),
    revenue: z.number().nullable().default(0),
    currency: z.string().nullable(),
  }),
});

export async function getCustomerActivity({
  workspaceId,
  customerId,
}: {
  workspaceId: string;
  customerId: string;
}) {
  // 1. fetch customer
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, workspaceId },
    select: { externalId: true },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  if (!customer.externalId) {
    return [];
  }

  // 2. fetch from tinybird
  const response = await customerActivityPipe({
    workspaceId,
    visitorId: customer.externalId,
    limit: 100,
  });

  // 3. group data
  return groupByDate(response.data);
}

type TinybirdEvent = {
  event_id: string;
  timestamp: string;
  event_type: string;
  event_name: string;
  page: string | null;
  url: string | null;
  referer: string | null;
  referer_url: string | null;
  browser: string;
  device: string;
  country: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  event_properties: string;
  revenue: number | null;
  currency: string | null;
};

function groupByDate(events: TinybirdEvent[]) {
  const groups: Record<string, { label: string; ts: number; items: TinybirdEvent[] }> = {};

  // pipe returns DESC → reverse once for oldest-first within each day
  const chronological = [...events].reverse();

  for (const ev of chronological) {
    const date = new Date(ev.timestamp);
    // use YYYY-MM-DD as the group key so it sorts correctly
    const key = date.toISOString().slice(0, 10);
    
    if (!groups[key]) {
      groups[key] = {
        // human-readable label for display
        label: date.toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        ts: date.getTime(),
        items: [],
      };
    }
    groups[key].items.push(ev);
  }

  return Object.values(groups)
    .sort((a, b) => a.ts - b.ts)   // oldest day first
    .map(({ label, items }) => ({ date: label, items }));
}


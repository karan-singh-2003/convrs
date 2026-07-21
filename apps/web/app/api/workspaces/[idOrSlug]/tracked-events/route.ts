// app/api/workspaces/[idOrSlug]/tracked-events/route.ts
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

const getTrackedEventsSchema = z.object({
  eventType: z.enum(["goals", "pageview", "identify", "exitlink"]).optional(),
});

export const GET = withWorkspace(
  async ({ req, workspace }) => {
    const { searchParams } = new URL(req.url);
    const { eventType } = getTrackedEventsSchema.parse({
      eventType: searchParams.get("eventType") ?? undefined,
    });

    const events = await prisma.trackedEvent.findMany({
      where: {
        workspaceId: workspace.id,
        ...(eventType && { eventType }),
      },
      orderBy: { lastSeenAt: "desc" },
      select: {
        eventName: true,
        eventType: true,
        trigger: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    });

    return NextResponse.json({ data: events });
  },
  { requiredPermission: "workspace:read" }
);

const createTrackedEventSchema = z.object({
  eventName: z
    .string()
    .trim()
    .min(1, "Event name is required")
    .max(100, "Event name is too long")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Only letters, numbers, underscores, and hyphens are allowed"
    ),
});

export const POST = withWorkspace(
  async ({ req, workspace }) => {
    console.log("POST in tracked event route", workspace.id);
    const body = await req.json();
    const { eventName } = createTrackedEventSchema.parse(body);

    const event = await prisma.trackedEvent.upsert({
      where: {
        workspaceId_eventName_eventType: {
          workspaceId: workspace.id,
          eventName,
          eventType: "goals",
        },
      },
      update: {
        lastSeenAt: new Date(),
      },
      create: {
        workspaceId: workspace.id,
        eventName,
        eventType: "goals",
        trigger: "goal",
      },
      select: {
        eventName: true,
        eventType: true,
        trigger: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    });

    return NextResponse.json({ data: event }, { status: 201 });
  },
  { requiredPermission: "workspace:write" } // adjust if your write permission key differs
);
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";

// GET /api/webhooks/[webhookId]/events - get logs for a webhook
export const GET = withWorkspace(
  async ({ workspace, params }) => {
    const { webhookId } = params;

    await prisma.webhook.findUniqueOrThrow({
      where: {
        id: webhookId,
        workspaceId: workspace.id,
      },
    });

    const events = await prisma.webhookEvent.findMany({
      where: {
        webhookId,
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 100, // Limit to last 100 events
    });

    const parsedEvents = events.map((event) => ({
      event_id: event.eventId,
      webhook_id: event.webhookId,
      message_id: event.messageId,
      event: event.event,
      url: event.url,
      http_status: event.httpStatus,
      request_body: JSON.parse(event.requestBody),
      response_body: event.responseBody,
      timestamp: event.timestamp.toISOString(),
    }));

    return NextResponse.json(parsedEvents);
  },
  {
    requiredPermission: "webhooks.read",
  }
);

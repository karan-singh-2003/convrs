import { prisma } from "@repo/db";
import email from "@repo/email";
import { interpolate } from "./utils/interpolate";
import AlertEmailTemplateModule from "@repo/email/templates/alert-email";
import React from "react";

// type VisitorInfo = {
//   email?: string | null;
//   name?: string | null;
//   firstName?: string | null;
// };

type EventInfo = {
  [key: string]: any;
  workspaceName?: string | null;
};

export async function sendAlertsForEvent({
  workspaceId,
  eventName,
  event,
}: {
  workspaceId: string;
  eventName: string;
  event?: EventInfo | null;
}) {
  try {
    if (!workspaceId || !eventName) return;
    const AlertEmailTemplate =
      (AlertEmailTemplateModule as any).default ?? AlertEmailTemplateModule;
    const alerts = await prisma.alert.findMany({
      where: {
        workspaceId,
        enabled: true,
        OR: [{ trigger: eventName }, { trigger: "" }],
      },
      orderBy: { createdAt: "desc" },
    });
    const workspaceOwner = await prisma.workspaceUsers.findFirst({
      where: { workspaceId, role: "owner" },
      select: { user: { select: { email: true } } },
    });
    const recipientEmail = workspaceOwner?.user?.email ?? null;

    if (alerts.length === 0) return;

    const variables = {
      first_name: event?.first_name || event?.firstName || "there",
      visitor_name: event?.visitor_name || event?.name || "User",
      visitor_country: event?.country || "Unknown",
      goal_name: eventName,
      trigger: eventName,
      site_name: event?.workspaceName || "",
    };

    console.log(
      `[sendAlertsForEvent] Found ${alerts.length} alert(s) to send for workspaceId=${workspaceId}, eventName=${eventName}, recipientEmail=${recipientEmail}`
    );
    await Promise.allSettled(
      alerts.map((alert: (typeof alerts)[number]) => {
        const subject = interpolate(alert.subject, variables);
        const content = interpolate(alert.content, variables);

        if (!recipientEmail) return Promise.resolve(null);

        return email.sendEmail({
          to: recipientEmail,
          subject,
          react: React.createElement(AlertEmailTemplate, { content }),
        });
      })
    );
  } catch (error) {
    console.error("[sendAlertsForEvent] Failed", error);
  }
}

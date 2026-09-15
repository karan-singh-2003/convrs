import { prisma } from "@repo/db";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import {
  detectTrafficSpike,
  isSpikeNotificationAllowed,
  DEFAULT_SPIKE_THRESHOLD,
} from "@/lib/analytics/traffic-spike";
import { sendBatchEmail } from "@repo/email";
import TrafficSpikeEmail from "@repo/email/templates/traffic-spike";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function handler(req: Request) {
  const { workspaceId } = await req.json();

  const preference = await prisma.notificationPreference.findUnique({
    where: { workspaceId },
  });

  // The dispatch cron already filters to trafficSpikes:true workspaces, but
  // this worker can be invoked directly (QStash retry, manual trigger) or
  // race a toggle-off that happened after dispatch queued the job — so the
  // toggle (and cooldown) must be re-checked here too, not just at dispatch
  // time.
  const gate = isSpikeNotificationAllowed(preference);
  if (!gate.allowed) {
    return Response.json({ skipped: true, reason: gate.reason });
  }

  const threshold = preference?.trafficSpikeThreshold ?? DEFAULT_SPIKE_THRESHOLD;
  const result = await detectTrafficSpike(workspaceId, threshold);

  if (!result.isSpike) {
    return Response.json({ skipped: true, reason: "no spike", ...result });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      users: {
        where: { role: { in: ["owner", "member"] } },
        select: { user: { select: { email: true, name: true } } },
      },
    },
  });

  if (!workspace || workspace.users.length === 0) {
    return Response.json({ skipped: true, reason: "no members" });
  }

  await sendBatchEmail(
    workspace.users.map(({ user }) => ({
      to: user.email!,
      subject: `Traffic spike detected on ${workspace.name}`,
      react: TrafficSpikeEmail({
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        recipientName: user.name,
        recipientEmail: user.email,
        currentClicks: result.currentClicks,
        baselineMean: Math.round(result.baselineMean),
        threshold,
      }),
    })),
    { idempotencyKey: `spike-${workspaceId}-${new Date().toISOString().slice(0, 13)}` }
  );

  await prisma.notificationPreference.update({
    where: { workspaceId },
    data: { lastSpikeSentAt: new Date() },
  });

  return Response.json({ sent: true, workspaceId, ...result });
}

export const POST = verifySignatureAppRouter(handler);
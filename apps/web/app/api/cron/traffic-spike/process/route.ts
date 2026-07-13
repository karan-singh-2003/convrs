import { prisma } from "@repo/db";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { detectTrafficSpike } from "@/lib/analytics/traffic-spike";
import { sendBatchEmail } from "@repo/email";
import TrafficSpikeEmail from "@repo/email/templates/traffic-spike";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const COOLDOWN_HOURS = 6;

async function handler(req: Request) {
  const { workspaceId } = await req.json();

  const preference = await prisma.notificationPreference.findUnique({
    where: { workspaceId },
  });

  if (preference?.lastSpikeSentAt) {
    const hoursSinceLastAlert =
      (Date.now() - preference.lastSpikeSentAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastAlert < COOLDOWN_HOURS) {
      return Response.json({ skipped: true, reason: "cooldown" });
    }
  }

  const result = await detectTrafficSpike(workspaceId);

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
        recipientName: user.name,
        currentClicks: result.currentClicks,
        baselineMean: Math.round(result.baselineMean),
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
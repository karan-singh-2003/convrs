import { prisma } from "@repo/db";
import { qstash, APP_DOMAIN_WITH_NGROK } from "@/lib/cron/qstash";
import { verifyVercelSignature } from "@/lib/cron/verify-vercel-signature";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  await verifyVercelSignature(req);

  const preferences = await prisma.notificationPreference.findMany({
    where: { weeklySummary: true },
    select: { workspaceId: true },
  });

  

  // batch publish to avoid hitting QStash rate limits in one go
  const BATCH_SIZE = 50;
  for (let i = 0; i < preferences.length; i += BATCH_SIZE) {
    const batch = preferences.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(({ workspaceId }) =>
        qstash.publishJSON({
          url: `${APP_DOMAIN_WITH_NGROK}/api/cron/weekly-summary/process`,
          body: { workspaceId },
          retries: 3,
        })
      )
    );
  }

  return Response.json({
    message: `Queued ${preferences.length} weekly summaries.`,
  });
}
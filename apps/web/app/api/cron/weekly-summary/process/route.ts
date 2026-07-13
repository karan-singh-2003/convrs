// import { prisma } from "@repo/db";
// import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
// import { computeWeeklySummary } from "@/lib/analytics/weekly-summary";
// import { sendBatchEmail } from "@repo/email";
// import WeeklySummaryEmail from "@repo/email/templates/weekly-summary";

// export const dynamic = "force-dynamic";
// export const maxDuration = 30;

// async function handler(req: Request) {
//   const { workspaceId } = await req.json();
//   console.log("workspaceId",workspaceId)

//   const workspace = await prisma.workspace.findUnique({
//     where: { id: workspaceId },
//     include: {
//       users: {
//         where: { role: { in: ["owner", "member"] } },
//         select: { user: { select: { email: true, name: true } } },
//       },
//     },
//   });

//   if (!workspace || workspace.users.length === 0) {
//     return Response.json({ skipped: true, reason: "no workspace or members" });
//   }

//   const stats = await computeWeeklySummary(workspaceId);

//   console.log("stats",stats)

//   // skip near-zero-traffic workspaces to avoid spamming empty reports
//   if (stats.clicks === 0) {
//     return Response.json({ skipped: true, reason: "no traffic" });
//   }

//   const weekOf = new Date().toISOString().slice(0, 10);

//   await sendBatchEmail(
//     workspace.users.map(({ user }) => ({
//       to: user.email!,
//       subject: `Your weekly report for ${workspace.name}`,
//       react: WeeklySummaryEmail({
//         workspaceName: workspace.name,
//         recipientName: user.name,
//         stats,
//       }),
//     })),
//     { idempotencyKey: `weekly-${workspaceId}-${weekOf}` }
//   );

//   await prisma.notificationPreference.update({
//     where: { workspaceId },
//     data: { lastWeeklySentAt: new Date() },
//   });

//   return Response.json({ sent: true, workspaceId, clicks: stats.clicks });
// }

// export const POST = verifySignatureAppRouter(handler);


import { prisma } from "@repo/db";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { computeWeeklySummary } from "@/lib/analytics/weekly-summary";
import { sendBatchEmail } from "@repo/email";
import WeeklySummaryEmail from "@repo/email/templates/weekly-summary";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function handler(req: Request) {
  const { workspaceId } = await req.json();
  console.log("workspaceId", workspaceId);

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
    return Response.json({ skipped: true, reason: "no workspace or members" });
  }

  // fall back to UTC if a workspace somehow has no timezone set
  const timezone = workspace.timezone ?? "UTC";

  const stats = await computeWeeklySummary(workspaceId, timezone);



  if (stats.clicks === 0) {
    return Response.json({ skipped: true, reason: "no traffic" });
  }

  const weekOf = new Date().toISOString().slice(0, 10);

  await sendBatchEmail(
    workspace.users.map(({ user }) => ({
      to: user.email!,
      subject: `Your weekly report for ${workspace.name}`,
      react: WeeklySummaryEmail({
        workspaceName: workspace.name,
        recipientName: user.name,
        stats,
      }),
    })),
    { idempotencyKey: `weekly-${workspaceId}-${weekOf}` }
  );

  await prisma.notificationPreference.update({
    where: { workspaceId },
    data: { lastWeeklySentAt: new Date() },
  });

  return Response.json({ sent: true, workspaceId, clicks: stats.clicks });
}

export const POST = verifySignatureAppRouter(handler);
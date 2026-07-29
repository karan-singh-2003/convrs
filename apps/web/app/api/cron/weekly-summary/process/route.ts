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


// import { prisma } from "@repo/db";
// import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
// import { computeWeeklySummary } from "@/lib/analytics/weekly-summary";
// import { sendBatchEmail } from "@repo/email";
// import WeeklySummaryEmail from "@repo/email/templates/weekly-summary";

// export const dynamic = "force-dynamic";
// export const maxDuration = 30;

// async function handler(req: Request) {
//   const { workspaceId } = await req.json();
//   console.log("workspaceId", workspaceId);

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

//   // fall back to UTC if a workspace somehow has no timezone set
//   const timezone = workspace.timezone ?? "UTC";

//   const stats = await computeWeeklySummary(workspaceId, timezone);



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
import { sendBatchEmail, sendEmail } from "@repo/email";
import { generateWeeklyReportPdf } from "@repo/email";
import WeeklySummaryEmail from "@repo/email/templates/weekly-summary";

export const dynamic = "force-dynamic";
// PDF rendering (many tables across ~10 sections) is slower than composing
// a plain-text email — bumped from 30s to give it headroom.
export const maxDuration = 60;

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

  const timezone = workspace.timezone ?? "UTC";
  const stats = await computeWeeklySummary(workspaceId, timezone, workspace.currency);

  if (stats.clicks === 0) {
    return Response.json({ skipped: true, reason: "no traffic" });
  }

  const weekOf = new Date().toISOString().slice(0, 10);

  // The PDF is identical for every recipient in this workspace (only the
  // email greeting differs per-user), so render it once outside the map
  // rather than once per recipient.
  const pdfBuffer = await generateWeeklyReportPdf({
    workspaceName: workspace.name,
    stats,
  });
  const pdfBase64 = pdfBuffer.toString("base64");
  const pdfFilename = `${workspace.slug}-weekly-report-${weekOf}.pdf`;

  // await sendBatchEmail(
  //   workspace.users.map(({ user }) => ({
  //     to: user.email!,
  //     subject: `Your weekly report for ${workspace.name}`,
  //     react: WeeklySummaryEmail({
  //       workspaceName: workspace.name,
  //       recipientName: user.name,
  //       stats: { clicks: stats.clicks, clicksChangePct: stats.clicksChangePct },
  //     }),
  //     // NOTE: assumes sendBatchEmail/your email provider (Resend-style)
  //     // accepts { filename, content: base64String } per email. If your
  //     // @repo/email implementation expects a different shape (raw Buffer,
  //     // different key names), adjust this block to match — share
  //     // sendBatchEmail's signature and I'll fix it exactly.
  //     attachments: [
  //       {
  //         filename: pdfFilename,
  //         content: pdfBase64,
  //       },
  //     ],
  //   })),
  //   { idempotencyKey: `weekly-${workspaceId}-${weekOf}` }
  // );

  for (const { user } of workspace.users) {
    const result = await sendEmail({
      to: user.email!,
      subject: `Your weekly report for ${workspace.name}`,
      react: WeeklySummaryEmail({
        workspaceName: workspace.name,
        recipientName: user.name,
        stats: {
          clicks: stats.clicks,
          clicksChangePct: stats.clicksChangePct,
        },
      }),
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBase64,
        },
      ],
    });

    console.dir(result, { depth: null });
  }

  await prisma.notificationPreference.update({
    where: { workspaceId },
    data: { lastWeeklySentAt: new Date() },
  });
  console.log("after email sending")

  return Response.json({
    sent: true,
    workspaceId,
    clicks: stats.clicks,
    pdfGenerated: true,
    pdfSizeKb: Math.round(pdfBuffer.byteLength / 1024),
  });
}

export const POST = verifySignatureAppRouter(handler);
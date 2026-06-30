// API route: /api/workspaces/[idOrSlug]/attribution-status
import { prisma } from "@repo/db";

export async function GET(req, { params }) {
  const attributed = await prisma.customer.findFirst({
    where: {
      workspaceId: params.idOrSlug,
      attributionStatus: "attributed",
    },
    select: { id: true },
  });

  return Response.json({ hasAttributedPayment: !!attributed });
}
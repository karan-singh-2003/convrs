import { prisma } from "@repo/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ idOrSlug: string }> }
) {
  const { idOrSlug } = await params;

  const attributed = await prisma.customer.findFirst({
    where: {
      workspaceId: idOrSlug,
      attributionStatus: "attributed",
    },
    select: {
      id: true,
    },
  });

  return Response.json({
    attributed: !!attributed,
  });
}
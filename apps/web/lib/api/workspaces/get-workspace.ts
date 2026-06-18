import { prisma } from "@repo/db";
import { getSession } from "@/lib/auth/utils";

export async function getWorkspace(slug: string) {
  const session = await getSession();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      slug,
      users: {
        some: {
          userId: session.user.id,
        },
      },
    },
  });

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  return workspace;
}
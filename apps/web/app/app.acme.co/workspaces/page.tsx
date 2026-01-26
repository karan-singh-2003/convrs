import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/utils";
import { prisma } from "@repo/db";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function WorkspacesPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const headersList = await headers();
  const searchParams = headersList.get("x-search-params") || "";

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      workspaceUsers: {
        include: {
          workspace: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const defaultWorkspace =
    user.defaultWorkspace || user.workspaceUsers[0]?.workspace?.slug;

  if (defaultWorkspace) {
    redirect(`/${defaultWorkspace}${searchParams}`);
  }

  redirect("/onboarding/workspace");
}

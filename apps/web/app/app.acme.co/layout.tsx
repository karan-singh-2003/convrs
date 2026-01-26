import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/utils";
import { prisma } from "@repo/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      workspaceUsers: { include: { workspace: true } },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const defaultWorkspace =
    user.defaultWorkspace || user.workspaceUsers[0]?.workspace?.slug;

  if (!defaultWorkspace) {
    redirect("/onboarding/workspace");
  }

  return <>{children}</>;
}

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/utils";
import { prisma } from "@repo/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();

  if (!session?.user?.id) {
    return <>{children}</>;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      workspaceUsers: { include: { workspace: true } },
    },
  });

  if (!user) {
    return <>{children}</>;
  }

  const defaultWorkspace =
    user.defaultWorkspace || user.workspaceUsers[0]?.workspace?.slug;

  if (defaultWorkspace) {
    redirect(`/${defaultWorkspace}`);
  }

  redirect("/onboarding/workspace");
}

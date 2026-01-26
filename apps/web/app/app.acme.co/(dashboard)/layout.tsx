import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/utils";
import { prisma } from "@repo/db";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";

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

  return <>{children}</>;
}

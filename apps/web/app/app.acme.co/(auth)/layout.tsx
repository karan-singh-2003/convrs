import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/utils";
import { prisma } from "@repo/db";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface AuthLayoutProps {
  children: ReactNode;
}

export default async function AuthLayout({ children }: AuthLayoutProps) {
  const session = await getSession();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";
  const searchParams = headersList.get("x-search-params") || "";

  // If user is logged in, redirect them to appropriate place
  if (session?.user?.id) {
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

    if (user) {
      // Check for ?next= parameter
      const nextUrl = new URLSearchParams(searchParams).get("next");
      if (nextUrl) {
        redirect(nextUrl);
      }

      // Check for pending invites
      const pendingInvites = await prisma.workspaceInvite.count({
        where: {
          email: user.email || undefined,
        },
      });

      const hasPendingInvites = pendingInvites > 0;

      // Get default workspace
      const defaultWorkspace =
        user.defaultWorkspace || user.workspaceUsers[0]?.workspace?.slug;

      // Check if user is new (within 24 hours of creation)
      const userCreatedAt = new Date(user.createdAt);
      const now = new Date();
      const onboardingWindow = 24 * 60 * 60 * 1000; // 24 hours
      const isNewUser =
        now.getTime() - userCreatedAt.getTime() < onboardingWindow;

      // Redirect to pending invites if they exist and user has no workspace
      if (hasPendingInvites && !defaultWorkspace) {
        redirect("/invites");
      }

      // Redirect to onboarding if new user without workspace
      if (isNewUser && !defaultWorkspace && !hasPendingInvites) {
        redirect("/onboarding");
      }

      // Redirect to default workspace
      if (defaultWorkspace) {
        redirect(`/${defaultWorkspace}`);
      }

      // Fallback to workspace onboarding
      redirect("/onboarding/workspace");
    }
  }

  return <>{children}</>;
}

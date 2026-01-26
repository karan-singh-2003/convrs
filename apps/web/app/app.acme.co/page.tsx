import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/utils";
import { prisma } from "@repo/db";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AppPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";
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

  // Handle ?next= query param
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
  const isNewUser = now.getTime() - userCreatedAt.getTime() < onboardingWindow;

  // Paths that should redirect to workspace root
  const workspaceRootPaths = [
    "/workspaces",
    "/links",
    "/analytics",
    "/events",
    "/customers",
    "/program",
    "/programs",
    "/settings",
    "/upgrade",
    "/guides",
    "/wrapped",
  ];

  const shouldRedirectToWorkspace =
    workspaceRootPaths.includes(pathname) ||
    pathname.startsWith("/program/") ||
    pathname.startsWith("/settings/");

  // If trying to access workspace-related paths, redirect to workspace
  if (shouldRedirectToWorkspace && defaultWorkspace) {
    let redirectPath = pathname;
    if (pathname === "/workspaces") {
      redirectPath = "";
    }
    redirect(`/${defaultWorkspace}${redirectPath}${searchParams}`);
  }

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

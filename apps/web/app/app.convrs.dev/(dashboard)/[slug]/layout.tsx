import { headers } from "next/headers";
import { redirect } from "next/navigation";
import WorkspaceAuth from "./auth";
import { getWorkspace } from "@/lib/api/workspaces/get-workspace";
import { hasWorkspaceAccess } from "@/lib/api/workspaces/check-subscription-status";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isBillingRoute =
    pathname === `/${slug}/billing` || pathname.startsWith(`/${slug}/billing/`);

  if (!isBillingRoute) {
    const workspace = await getWorkspace(slug);
    const access = await hasWorkspaceAccess(workspace.id);

    if (!access) {
      redirect(`/${slug}/billing`);
    }
  }

  return <WorkspaceAuth>{children}</WorkspaceAuth>;
}

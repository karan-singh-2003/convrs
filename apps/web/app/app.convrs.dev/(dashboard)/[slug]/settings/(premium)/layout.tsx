import { getWorkspace } from "@/lib/api/workspaces/get-workspace";
import { hasWorkspaceAccess } from "@/lib/api/workspaces/check-subscription-status";
import { SubscriptionRequired } from "@/ui/workspaces/subscription-required";

export default async function PremiumSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;

  const workspace = await getWorkspace(slug);

  const hasAccess = await hasWorkspaceAccess(workspace.id);

  if (!hasAccess) {
    return (
      <SubscriptionRequired
        slug={slug}
      />
    );
  }

  return children;
}
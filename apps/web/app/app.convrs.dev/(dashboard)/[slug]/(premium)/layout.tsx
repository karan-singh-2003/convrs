// app/[slug]/(premium)/layout.tsx

import { SubscriptionRequired } from "@/ui/workspaces/subscription-required";
import { getWorkspace } from "@/lib/api/workspaces/get-workspace";
import { hasWorkspaceAccess } from "@/lib/api/workspaces/check-subscription-status";

export default async function PremiumLayout({
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

  const access = await hasWorkspaceAccess(workspace.id);

  if (!access) {
    return <SubscriptionRequired slug={slug} />;
  }

  return children;
}
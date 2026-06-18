"use client";
import { useParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import useWorkspaces from "@/lib/swr/use-workspaces";
import { useEffect, useMemo } from "react";
import { SidebarNav } from "./sidebar-nav";
import useWorkspace from "@/lib/swr/use-workspace";

const NAV_AREAS = {
  default: ({
    slug,
    pathname,
    queryString,
    premiumAccess,
  }: {
    slug?: string;
    pathname: string;
    queryString?: string;
    premiumAccess: boolean;
  }) => ({
    title: "",
    content: [
      { title: "Analytics", href: `/${slug}`, exact: true },
      { title: "Customers", href: `/${slug}/customers` },
      { title: "Realtime", href: `/${slug}/realtime` },
      { title: "Settings", href: `/${slug}/settings` },
    ],
  }),

  workspaceSettings: ({
    slug,
    premiumAccess,
  }: {
    slug?: string;
    pathname: string;
    queryString?: string;
    premiumAccess: boolean;
  }) => ({
    title: "Back to Workspace",
    backHref: `/${slug}`,
    content: [
      {
        heading: "Workspace",
        items: [
          { title: "General", href: `/${slug}/settings`, exact: true },
          { title: "Members", href: `/${slug}/settings/members` },
          { title: "Billing", href: `/${slug}/settings/billing` },
          ...(premiumAccess
            ? [
                { title: "Revenue", href: `/${slug}/settings/revenue` },
                { title: "Alerts", href: `/${slug}/settings/alerts` },
              ]
            : []),
        ],
      },
      {
        heading: "Developer",
        items: [
          ...(premiumAccess
            ? [{ title: "Script", href: `/${slug}/settings/script` }]
            : []),
        ],
      },
    ],
  }),

  userSettings: ({
    slug,
  }: {
    slug?: string;
    pathname: string;
    queryString?: string;
    premiumAccess: boolean;
  }) => ({
    title: "Account Settings",
    backHref: `/${slug}`,
    content: [
      { title: "Profile", href: `/account/settings`, exact: true },
      { title: "Security", href: `/account/settings/security` },
    ],
  }),
};

export function AppSidebar({
  forcedArea,
}: {
  forcedArea?: "default" | "workspaceSettings" | "userSettings";
} = {}) {
  const { slug: paramsSlug } = useParams<{ slug?: string }>();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { workspaces } = useWorkspaces();
  const { subscriptionStatus } = useWorkspace();

  const hasPremiumAccess =
    subscriptionStatus === "active" || subscriptionStatus === "trialing";

  // Store the current workspace slug in session storage so we can remember it on the account settings page
  useEffect(() => {
    if (paramsSlug) {
      sessionStorage.setItem("boilercode_last_workspace_slug", paramsSlug);
    }
  }, [paramsSlug]);

  // Validate and clear session storage if user is not authorized for the workspace
  useEffect(() => {
    if (status === "unauthenticated") {
      sessionStorage.removeItem("boilercode_last_workspace_slug");
      return;
    }
    if (workspaces && typeof window !== "undefined") {
      const storedSlug = sessionStorage.getItem(
        "boilercode_last_workspace_slug"
      );
      if (storedSlug) {
        const hasAccess = workspaces.some((ws) => ws.slug === storedSlug);
        if (!hasAccess) {
          sessionStorage.removeItem("boilercode_last_workspace_slug");
        }
      }
    }
  }, [workspaces, session, status]);

  const slug =
    paramsSlug ||
    (typeof window !== "undefined" && workspaces
      ? (() => {
          const storedSlug = sessionStorage.getItem(
            "boilercode_last_workspace_slug"
          );
          if (storedSlug && workspaces.some((ws) => ws.slug === storedSlug)) {
            return storedSlug;
          }
          return undefined;
        })()
      : undefined);

  const currentArea = useMemo(() => {
    if (forcedArea) {
      return forcedArea;
    }

    return pathname.startsWith("/account/settings")
      ? "userSettings"
      : pathname.startsWith(`/${slug}/settings`)
        ? "workspaceSettings"
        : "default";
  }, [forcedArea, pathname, slug]);

  return (
    <SidebarNav
      currentArea={currentArea}
      areas={NAV_AREAS}
      data={{
        slug,
        pathname,
        queryString: "",
        premiumAccess: hasPremiumAccess,
      }}
    />
  );
}
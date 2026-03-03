"use client";
import { useParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import useWorkspaces from "@/lib/swr/use-workspaces";
import { useEffect, useMemo } from "react";
import { SidebarNav } from "./sidebar-nav";

const NAV_AREAS = {
  default: ({
    slug,
    pathname,
    queryString,
  }: {
    slug?: string | null;
    pathname: string;
    queryString?: string;
  }) => ({
    title: "",
    content: [
      { title: "Home", href: `/${slug}` },
      { title: "Settings", href: `/${slug}/settings` },
    ],
  }),

  workspaceSettings: ({
    slug,
  }: {
    slug?: string | null;
    pathname: string;
    queryString?: string;
  }) => ({
    title: "Back to Workspace",
    backHref: `/${slug}`,
    content: [
      {
        heading: "Workspace",
        items: [
          { title: "General", href: `/${slug}/settings`, exact: true },
          { title: "Members", href: `/${slug}/settings/members` },
          { title: "Security", href: `/${slug}/settings/security` },
          { title: "Billing", href: `/${slug}/settings/billing` },
        ],
      },
      {
        heading: "Developer",
        items: [
          { title: "API keys", href: `/${slug}/settings/tokens` },
          { title: "Webhooks", href: `/${slug}/settings/webhooks` },
        ],
      },
    ],
  }),

  userSettings: ({
    slug,
  }: {
    slug?: string | null;
    pathname: string;
    queryString?: string;
  }) => ({
    title: "Account Settings",
    backHref: `/${slug}`,
    content: [
      { title: "Profile", href: `/account/settings`, exact: true },
      { title: "Security", href: `/account/settings/security` },
    ],
  }),
};

export function AppSidebar() {
  const { slug: paramsSlug } = useParams<{ slug?: string }>();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { workspaces } = useWorkspaces();

  // Store the current workspace slug in session storage so we can remmeber it on account settings page

  useEffect(() => {
    if (paramsSlug) {
      sessionStorage.setItem("boilercode_last_workspace_slug", paramsSlug);
    }
  }, [paramsSlug]);

  // Validata and clear session storage if user is not authorized for the workspace
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
          return null;
        })()
      : null);

  const currentArea = useMemo(() => {
    return pathname.startsWith("/account/settings")
      ? "userSettings"
      : pathname.startsWith(`/${slug}/settings`)
        ? "workspaceSettings"
        : "default";
  }, [pathname, slug]);

  return (
    <SidebarNav
      currentArea={currentArea}
      areas={NAV_AREAS}
      data={{
        slug,
        pathname,
        queryString: "",
      }}
    />
  );
}

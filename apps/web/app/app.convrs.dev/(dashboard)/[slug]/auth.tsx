"use client";

import { ErrorCodes } from "@/lib/api/error-codes";
import useWorkspace from "@/lib/swr/use-workspace";
import LayoutLoader from "@/ui/layout/layout-loader";
import { DashboardSkeleton } from "@/ui/analytics/dashboard-skeleton";
import { notFound, redirect, usePathname, useParams } from "next/navigation";
import { ReactNode } from "react";

export default function WorkspaceAuth({ children }: { children: ReactNode }) {
  const { slug } = useParams();
  const pathname = usePathname();
  const { loading, error, } = useWorkspace();

  const isOverviewRoute = pathname === `/${slug}`;

  if (loading) {
    return isOverviewRoute ? <DashboardSkeleton /> : <LayoutLoader />;
  }

  if (error) {
    if (error.status === ErrorCodes.not_found) {
      notFound();
    } else if (
      [ErrorCodes.invite_pending, ErrorCodes.invite_expired].includes(
        error.status
      )
    ) {
      redirect(`/${slug}/invite`);
    }
  }

  return children;
}

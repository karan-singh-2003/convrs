import { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return <>{children}</>;
}

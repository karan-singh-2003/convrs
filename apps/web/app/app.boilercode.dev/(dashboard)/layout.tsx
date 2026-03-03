import { AppSidebar } from "@/ui/layout/sidebar/app-sidebar";
import { MainNav } from "@/ui/layout/sidebar/main-nav";
import { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-white">
      <MainNav sidebar={AppSidebar}>{children}</MainNav>
    </div>
  );
}

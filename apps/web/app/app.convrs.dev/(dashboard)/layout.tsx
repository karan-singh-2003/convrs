"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@repo/utils";
import { Cog, Globe, Settings2, Smile } from "lucide-react";
import { MainNav } from "@/ui/layout/sidebar/main-nav";
import { AppSidebar } from "@/ui/layout/sidebar/app-sidebar";
import { useLiveVisitors } from "@/lib/analytics/use-live-visitors";
import useWorkspace from "@/lib/swr/use-workspace";
import { ThemeScope } from "@/styles/theme-scope";

function AnalyticsIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 26 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-neutral-800"
    >
      <path
        d="M24.0896 22.4805H1.60938"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24.0896 16.0573C16.8638 16.0573 20.1255 3.21143 12.8495 3.21143C5.6237 3.21143 8.83516 16.0573 1.60938 16.0573"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-[30px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.063 16.658.26-1.477m2.605-14.772.26-1.477m0 17.726-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205 12 12m6.894 5.785-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495" />
    </svg>

  )
}
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { projectToken } = useWorkspace();
  const { slug } = useParams<{ slug: string }>();
  const { count } = useLiveVisitors(projectToken || "")

  const items = [
    {
      href: `/${slug}`,
      label: "Analytics",
      icon: AnalyticsIcon,
      exact: true,
    },
    {
      href: `/${slug}/customers`,
      label: "Customers",
      icon: Smile,
    },
    {
      href: `/${slug}/realtime`,
      label: "Realtime",
      icon: Globe,
    },
    {
      href: `/${slug}/settings`,
      label: "Settings",
      icon: SettingsIcon,
    },
  ];

  return (
    <ThemeScope>

      <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-1.5 border border-neutral-200 rounded-2xl bg-neutral-100 p-1 py-1.5">
          {items.map(({ href, icon: Icon, exact, label }) => {
            const active = exact
              ? pathname === href
              : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex h-10 items-center justify-center gap-1 rounded-xl transition-all duration-200",
                  label === "Realtime" ? "w-auto px-2" : "w-10",
                  active
                    ? "bg-white text-neutral-600"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-600"
                )}
              >
                <Icon className="h-[26px] w-[26px]" />

                {label === "Realtime" && count > 0 && (
                  <span className="font-alexandria text-lg ml-1 text-neutral-600">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <MainNav sidebar={AppSidebar}>{children}</MainNav>
    </ThemeScope>
  );
}

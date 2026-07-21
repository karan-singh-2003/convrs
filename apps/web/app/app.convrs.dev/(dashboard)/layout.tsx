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
import { Suspense } from "react";

function AnalyticsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 26 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-[25px]", className)}
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

function SmileIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={cn("size-[33px]", className)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
    </svg>

  );
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className={cn("size-[34px]", className)}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.063 16.658.26-1.477m2.605-14.772.26-1.477m0 17.726-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205 12 12m6.894 5.785-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495"
      />
    </svg>
  );
}
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={cn("size-[30px]", className)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>

  )
}
function DashboardLayoutContent({
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
      icon: SmileIcon,
    },

    {
      href: `/${slug}/settings`,
      label: "Settings",
      icon: SettingsIcon,
    },
    {
      href: `/${slug}/realtime`,
      label: "Realtime",
      icon: GlobeIcon,
    },
  ];

  return (
    <ThemeScope>

      <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-1 border border-border-subtle rounded-2xl bg-bg-card p-1 py-1.5">
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
                  label === "Realtime" ? "px-1 " : "w-10",
                  active
                    ? "bg-bg-emphasis text-content-default"
                    : "text-content-subtle/50 hover:bg-bg-emphasis hover:text-content-default"
                )}
              >
                <Icon />

                {label === "Realtime" && count > 0 && (
                  <span className="font-alexandria pr-2 text-lg  ">
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

export default function DashboardLayout({ children }) {
  return (
    <Suspense fallback={null}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
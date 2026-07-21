// app/app.convrs.dev/(shared)/shared/[id]/layout.tsx

"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@repo/utils";
import { Globe } from "lucide-react";
import { useLiveVisitors } from "@/lib/analytics/use-live-visitors";

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

export default function SharedDashboardLayout({ projectToken }: { projectToken: string }) {
  const { count } = useLiveVisitors(projectToken || "")
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();

  const items = [
    {
      href: `/shared/${id}`,
      label: "Analytics",
      icon: AnalyticsIcon,
      exact: true,
    },
    {
      href: `/shared/${id}/realtime`,
      label: "Realtime",
      icon: Globe,
    },
  ];

  return (
    <>
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
                  <span className="font-alexandria text-lg ml-1  text-neutral-600">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
      {/* 
      {children} */}
    </>
  );
}

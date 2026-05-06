"use client";

import { useMediaQuery } from "@repo/ui";
import { cn } from "@repo/utils";
import { usePathname } from "next/navigation";
import React, { createContext, Dispatch, useEffect, useState } from "react";
import { UserDropdown } from "./user-dropdown";
import Link from "next/link";
import { NavButton } from "../page-content/nav-button";
type SideNavContext = {
  isOpen: boolean;
  setIsOpen: Dispatch<React.SetStateAction<boolean>>;
};

export const SideNavContent = createContext<SideNavContext>({
  isOpen: false,
  setIsOpen: () => {},
});

export function MainNav({
  children,
  sidebar: Sidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ComponentType<{
    forcedArea?: "default" | "workspaceSettings" | "userSettings";
  }>;
}) {
  const pathname = usePathname();
  const { isMobile } = useMediaQuery();
  const [isOpen, setIsOpen] = useState(false);

  // Prevent body scroll when side nav is open on mobile
  useEffect(() => {
    document.body.style.overflow = isOpen && isMobile ? "hidden" : "auto";
  }, [isOpen, isMobile]);

  // Close side nav when pathname changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const isSettings = pathname.includes("/settings");
  const isDashboard = pathname === "/" || pathname === "/dashboard";
  const isRealtime = pathname.includes("/realtime");

  return (
    <div
      className={cn(
        "w-full flex flex-col",
        isRealtime && "h-dvh overflow-hidden"
      )}
    >
      <SideNavContent.Provider value={{ isOpen, setIsOpen }}>
        <div
          className={cn(
            "fixed inset-0 z-50 md:hidden transition-[background-color,backdrop-filter]",
            isOpen
              ? "bg-black/20 backdrop-blur-sm"
              : "pointer-events-none bg-transparent"
          )}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.stopPropagation();
              setIsOpen(false);
            }
          }}
        >
          <div
            className={cn(
              "absolute left-0 top-0 h-full w-[248px] max-w-[85vw] border-r border-[#EBEBEB] bg-[#fafafa] transition-transform",
              isOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <Sidebar />
          </div>
        </div>

        {!isDashboard ? (
          <div
            className={cn(
              "fixed top-0 left-0 z-30 w-full",
              isRealtime
                ? "bg-white/55 backdrop-blur-md supports-[backdrop-filter]:bg-white/45 "
                : "bg-white"
            )}
          >
            <div className=" flex h-12 w-full px-4 md:px-0 mx-auto  md:max-w-screen-lg items-center justify-between gap-x-4  ">
              <div className="flex items-center justify-center gap-4 min-w-0">
                <div className="w-full  flex items-center gap-4">
                  <div className="md:hidden">
                    <NavButton />
                  </div>
                  <div className="hidden md:block">
                    <Sidebar forcedArea="default" />
                  </div>
                </div>
              </div>
              <UserDropdown />
            </div>
          </div>
        ) : (
          <div className=" py-2 flex h-full w-full mx-auto  max-w-screen-md items-center justify-between gap-4 px-4 md:px-0">
            <nav className="flex items-center w-full justify-between gap-x-2">
              <div className="flex items-center gap-2.5 font-display text-sm font-medium text-neutral-600">
                <h1 className="font-semibold font-display text-[14.5px]">
                  Convrs
                </h1>
              </div>
              <UserDropdown />
            </nav>
          </div>
        )}

        <div
          className={cn(
            "flex-1 min-h-0",
            isRealtime ? "p-0 " : !isDashboard ? "pt-10 md:pt-16 pb-4" : "py-4"
          )}
        >
          {isSettings ? (
            <div className="w-full md:max-w-screen-lg mx-auto sm:flex-row lg:px-8 px-0 md:px-0 md:grid md:grid-cols-[248px_minmax(0,1fr)] md:gap-4">
              <div className="hidden md:block md:my-0 md:py-0 py-2 w-full min-w-0">
                {/* On mobile: horizontal scroll with fade edges to hint more tabs exist */}
                <div className="relative md:static  w-full min-w-0">
                  {/* Fade right edge — only visible on mobile when content overflows */}
                  {/* <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent z-10 md:hidden" /> */}
                  <Sidebar />
                </div>
              </div>
              <div className="min-w-0 max-w-screen-lg rounded-2xl bg-neutral-50">
                <div className="px-6 md:px-0 py-5">{children}</div>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "px-6 md:px-0",
                isRealtime ? "bg-transparent" : "bg-white"
              )}
            >
              <div className={cn(isRealtime ? "py-0" : "py-4")}>{children}</div>
            </div>
          )}
        </div>
      </SideNavContent.Provider>
    </div>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();

  // Split path and remove empty strings
  const segments = pathname.split("/").filter(Boolean);

  // Remove first segment (workspace slug)
  const filteredSegments = segments.slice(1);

  return (
    <nav className="flex items-center text-[13.5px] font-default font-medium text-neutral-500">
      {filteredSegments.map((segment, idx) => {
        const isLast = idx === filteredSegments.length - 1;

        const href = "/" + segments.slice(0, idx + 2).join("/"); // keep slug in actual link

        const label = segment.charAt(0).toUpperCase() + segment.slice(1);

        return (
          <div key={idx} className="flex items-center">
            {!isLast ? (
              <>
                <Link
                  href={href}
                  className="hover:text-neutral-600 text-[13.5px]  font-medium text-neutral-500 font-default"
                >
                  {label}
                </Link>
                <span className="mx-2  text-neutral-400">&gt;</span>
              </>
            ) : (
              <span className="text-neutral-500 md:text-[13.5px] text-sm font-medium font-default ">
                {label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

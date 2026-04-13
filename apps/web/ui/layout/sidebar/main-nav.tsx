"use client";

import { useMediaQuery } from "@repo/ui";
import { cn } from "@repo/utils";
import { usePathname } from "next/navigation";
import React, { createContext, Dispatch, useEffect, useState } from "react";
import { UserDropdown } from "./user-dropdown";
import { Area } from "./sidebar-nav";
import Link from "next/link";
import { NavButton } from "../page-content/nav-button";
import path from "path";
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
                <Sidebar forcedArea="default" />
              </div>
            </div>
            <UserDropdown />
          </div>
        </div>
      ) : (
        <div className=" py-2 flex h-full w-full mx-auto lg:px-8 max-w-screen-md items-center justify-between gap-4 px-4 md:px-0">
          <nav className="flex items-center w-full justify-between gap-x-2">
            <div className="flex items-center gap-2.5 font-display text-sm font-medium text-neutral-600">
              {" "}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 182 199"
                fill="none"
                className="size-6"
              >
                <path
                  d="M0 50.837L90.3333 0L182 50.837V148.832L90.3333 199L0 148.832V50.837Z"
                  fill="#363636"
                />
                <path
                  d="M10 50.0038L90.1639 5L173 49.6679L90.832 94L10 50.0038Z"
                  fill="white"
                />
              </svg>
              <h1 className="font-normal font-default text-[14.5px]">
                Posthog
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
            <div className="md:my-0 md:py-0 py-2 w-full min-w-0">
              {/* On mobile: horizontal scroll with fade edges to hint more tabs exist */}
              <div className="relative md:static  w-full min-w-0">
                {/* Fade right edge — only visible on mobile when content overflows */}
                {/* <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent z-10 md:hidden" /> */}
                <Sidebar />
              </div>
            </div>
            <div className="min-w-0 max-w-screen-lg rounded-2xl bg-neutral-50">
              <SideNavContent.Provider value={{ isOpen, setIsOpen }}>
                <div className="px-6 md:px-0 py-5">{children}</div>
              </SideNavContent.Provider>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "px-6 md:px-0",
              isRealtime ? "bg-transparent" : "bg-white"
            )}
          >
            <SideNavContent.Provider value={{ isOpen, setIsOpen }}>
              <div className={cn(isRealtime ? "py-0" : "py-4")}>{children}</div>
            </SideNavContent.Provider>
          </div>
        )}
      </div>
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

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

  return (
    <div className="min-h-full w-full  flex flex-col ">
      {!isDashboard ? (
        <div className="h-12  bg-white">
          <div className=" flex h-full w-full mx-auto  max-w-screen-lg items-center justify-between gap-4  ">
            <div className="flex items-center gap-4 min-w-0">
              {/* <NavButton /> */}
              <div className="w-full ">
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
              <h1 className="font-normal font-default text-[14.5px]">Posthog</h1>
            </div>
            <UserDropdown />
          </nav>
        </div>
      )}

      <div className="flex-1 min-h-0 py-4">
        {isSettings ? (
          <div className=" w-full max-w-screen-lg mx-auto my-2 sm:flex-row lg:px-8 px-0 md:px-0 md:grid md:grid-cols-[248px_minmax(0,1fr)] md:gap-4">
            <div className="md:my-5 ">
              <Sidebar />
            </div>
            <div className="min-w-0 max-w-screen-lg rounded-2xl bg-neutral-50">
              <SideNavContent.Provider value={{ isOpen, setIsOpen }}>
                <div className="px-6 md:px-0 py-8">{children}</div>
              </SideNavContent.Provider>
            </div>
          </div>
        ) : (
          <div className=" px-6 md:px-0 bg-white">
            <SideNavContent.Provider value={{ isOpen, setIsOpen }}>
              <div className="py-4">{children}</div>
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

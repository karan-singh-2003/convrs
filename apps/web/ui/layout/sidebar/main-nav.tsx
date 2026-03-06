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
  sidebar: React.ComponentType;
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

  const hideAvatar = pathname.includes("/settings");
  return (
    <div className="min-h-screen md:grid md:grid-cols-[min-content_minmax(0,1fr)]">
      {/* Side nav backdrop */}
      <div
        className={cn(
          "fixed left-0 top-0 z-50 h-dvh w-screen transition-[background-color,backdrop-filter] md:sticky md:z-auto md:w-full md:bg-transparent",
          isOpen
            ? "bg-black/20 backdrop-blur-sm"
            : "bg-transparent max-md:pointer-events-none"
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            e.stopPropagation();
            setIsOpen(false);
          }
        }}
      >
        {/* Side nav */}
        <div
          className={cn(
            "relative h-full w-min max-w-full bg-white transition-transform md:translate-x-0",
            !isOpen && "-translate-x-full"
          )}
        >
          <Sidebar />
        </div>
      </div>
      <div className="h-screen">
        <div className="relative h-full overflow-y-auto bg-white ">
          <SideNavContent.Provider value={{ isOpen, setIsOpen }}>
            <div className="h-10 border-b flex justify-between items-center border-[#EBEBEB]/50">
              {/* breadcrumbs */}
              <div className="px-4 flex items-center md:gap-x-4 gap-x-2">
                <NavButton />
                <Breadcrumbs />
              </div>
              {/* user avatar */}
              {!hideAvatar && <UserDropdown />}
            </div>
            <div className="px-4 md:px-0">{children}</div>
          </SideNavContent.Provider>
        </div>
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

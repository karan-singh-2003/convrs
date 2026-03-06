"use client";

import { useContext } from "react";
import { SideNavContent } from "../sidebar/main-nav";
import { Button, LayoutSidebar } from "@repo/ui";

export function NavButton() {
  const { setIsOpen } = useContext(SideNavContent);
  return (
    <Button
      type="button"
      variant="outline"
      icon={<LayoutSidebar className="size-4 text-neutral-600 "/>}
      className="h-auto w-fit md:hidden md:p-1 p-0"
      onClick={() => setIsOpen((o) => !o)}
    />
  );
}

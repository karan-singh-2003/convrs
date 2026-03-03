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
      icon={<LayoutSidebar className="size-4"/>}
      className="h-auto w-fit md:hidden p-1"
      onClick={() => setIsOpen((o) => !o)}
    />
  );
}

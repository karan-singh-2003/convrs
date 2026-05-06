"use client";

import { cn } from "@repo/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren, useMemo } from "react";
import { Button } from "@repo/ui";
import { WorkspaceDropdown } from "./workspace-dropdown";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export type NavItemType = {
  title: string;
  href: string;
  exact?: boolean;
  isActive?: (pathname: string, href: string) => boolean;
};
export type NavSectionType = {
  heading: string;
  items: NavItemType[];
};
export type SidebarNavArea<T extends Record<any, any>> = (args: T) => {
  title?: string;
  backHref?: string;
  content: (NavItemType | NavSectionType)[];
};

export function SidebarNav<T extends Record<any, any> & { slug?: string }>({
  currentArea,
  areas,
  data,
}: {
  currentArea: string | null;
  areas: Record<string, SidebarNavArea<T>>;
  data: T;
}) {
  const router = useRouter();
  const slug = data?.slug;

  return (
    <div
      className={cn(
        "flex  w-full flex-col gap-4",
        currentArea === "default" ? "px-3  py-2" : "px-0 p-2"
      )}
    >
      <nav className="size-full">
        <div className="size-full overflow-visible md:overflow-hidden rounded-none">
          <div className="scrollbar-hide relative flex h-full overflow-y-auto overflow-x-visible md:overflow-x-hidden">
            <div className="relative flex grow items-center text-neutral-500">
              <div className="relative w-full  grow">
                {areas &&
                  Object.entries(areas).map(([area, areaConfig]) => {
                    const { title, backHref, content } = areaConfig(data);

                    return (
                      <Area
                        key={area}
                        visible={area === currentArea}
                        area={area}
                      >
                        {title === "" && (
                          <div className="w-full">
                            <WorkspaceDropdown />
                          </div>
                        )}
                        <div
                          className={cn(
                            "flex w-full",
                            area === "default" ? "flex-row" : "flex-col"
                          )}
                        >
                          {/* tabs */}
                          {title && (
                            <div className="my-1 px-2">
                              {backHref ? null : ( // </Link> //   </span> //     {title} //   <span className="font-display text-[13px] md:text-[13.5px]"> //   <ArrowLeft size={14} /> // > //   className="text-[13px] font-medium gap-x-2 flex items-center text-neutral-500 hover:text-neutral-600" //   href={backHref} // <Link
                                <h2 className="text-sm font-medium font-display text-neutral-700">
                                  {title}
                                </h2>
                              )}
                            </div>
                          )}
                          {area !== "default" && backHref && (
                            <Link href={`/${slug}`} className="px-3 py-1 text-[13.5px] flex items-center gap-x-2 md:hidden  mb-3 text-neutral-600 font-default font-medium">
                              <ArrowLeft size={14} />
                             
                              {title === "Settings"
                                ? "Workspaces"
                                : "Dashboard"}
                            </Link>
                          )}
                          <div
                            className={cn(
                              "flex w-full",
                              area === "default"
                                ? "md:flex-row flex-col "
                                : "md:flex-col  flex-col overflow-x-auto flex-nowrap scrollbar-hide pb-px"
                            )}
                          >
                            {content.map((item) =>
                              "heading" in item ? (
                                item.items.map((subItem) => (
                                  <NavItem
                                    key={subItem.href}
                                    item={subItem}
                                    area={area}
                                  />
                                ))
                              ) : (
                                <NavItem
                                  key={item.href}
                                  item={item}
                                  area={area}
                                />
                              )
                            )}
                          </div>
                        </div>
                      </Area>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}

export function Area({
  visible,
  area,
  children,
}: PropsWithChildren<{ visible: boolean; area: string }>) {
  return (
    <div
      className={cn(
        "left-0  top-0 flex md:flex-row flex-col gap-y-3 size-full gap-x-1 md:gap-x-5 w-full transition-[opacity,transform] duration-300",
        area === "default" ? "items-center" : "items-start",
        visible
          ? "relative opacity-100"
          : "pointer-events-none absolute translate-x-full opacity-0"
      )}
      aria-hidden={!visible ? "true" : undefined}
    >
      {children}
    </div>
  );
}

function NavItem({ item, area }: { item: NavItemType; area: string }) {
  const { title, href, exact, isActive: customIsActive } = item;
  const pathname = usePathname();

  const isActive = useMemo(() => {
    if (customIsActive) {
      return customIsActive(pathname, href);
    }
    const hrefWithoutQuery = href.split("?")[0];
    return exact
      ? pathname === hrefWithoutQuery
      : pathname.startsWith(hrefWithoutQuery);
  }, [pathname, href, exact, customIsActive]);

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-none font-display font-medium my-0.5 py-0.5 px-2 transition-colors",
        // flex-shrink-0 prevents tabs from squishing on mobile scroll
        area === "default"
          ? "px-2 text-[14.5px] md:text-[14.5px]"
          : "flex-shrink-0 px-3 py-1 text-[14.5px] md:text-[16.5px]",
        isActive
          ? "text-neutral-700/90"
          : "text-neutral-500/80 hover:text-neutral-500"
      )}
    >
      {title}
    </Link>
  );
}

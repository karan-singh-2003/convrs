"use client";

import { cn } from "@repo/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren, useMemo } from "react";
import { Button } from "@repo/ui";
import { WorkspaceDropdown } from "./workspace-dropdown";
import { ArrowLeft } from "lucide-react";
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
        currentArea === "default" ? "px-0" : "px-0"
      )}
    >
      <nav className="size-full">
        <div className="size-full overflow-hidden rounded-none   p-2">
          <div className="scrollbar-hide relative flex h-full overflow-y-auto overflow-x-hidden">
            <div className="relative flex grow items-center text-neutral-500">
              <div className="relative w-full  grow">
                {areas &&
                  Object.entries(areas).map(([area, areaConfig]) => {
                    const { title, backHref, content } = areaConfig(data);

                    return (
                      <Area key={area} visible={area === currentArea}>
                        {title === "" && (
                          <div className="w-full">
                            <WorkspaceDropdown />
                          </div>
                        )}
                        <div
                          className={cn(
                            "flex w-full",
                            area === "default"
                              ? "flex-row"
                              : "md:flex-col flex-row  "
                          )}
                        >
                          {/* tabs */}
                          {title && (
                            <div className="my-1 px-2">
                              {backHref ? //   <span className="font-display text-[13px] md:text-[13.5px]"> //   <ArrowLeft size={14} /> // > //   className="text-[13px] font-medium gap-x-2 flex items-center text-neutral-500 hover:text-neutral-600" //   href={backHref} // <Link
                              //     {title}
                              //   </span>
                              // </Link>
                              null : (
                                <h2 className="text-sm font-medium font-display text-neutral-700">
                                  {title}
                                </h2>
                              )}
                            </div>
                          )}
                          <div
                            className={cn(
                              "flex w-full ",
                              area === "default"
                                ? "flex-row"
                                : "md:flex-col  flex-row overflow-x-auto flex-nowrap scrollbar-none"
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

  console.log("area in navitem", area);

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-none font-display font-medium my-0.5 py-0.5 px-2 transition-colors shrink-0",
        area === "default"
          ? "px-2 text-[14px] md:text-[14.5px]"
          : "px-3 py-1  text-[14px] md:text-[16.5px]",
        isActive
          ? "text-neutral-700/90"
          : "text-neutral-500/80 hover:text-neutral-500"
      )}
    >
      {title}
    </Link>
  );
}

export function Area({
  visible,
  children,
}: PropsWithChildren<{ visible: boolean }>) {
  return (
    <div
      className={cn(
        "left-0  top-0 flex sm:flex-row  size-full gap-x-1 md:gap-x-5 w-full items-center transition-[opacity,transform] duration-300",
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

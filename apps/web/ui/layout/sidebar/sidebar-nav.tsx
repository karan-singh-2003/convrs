"use client";

import { cn } from "@repo/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren, useMemo } from "react";
import { Button } from "@repo/ui";
import { WorkspaceDropdown } from "./workspace-dropdown";
import { ArrowLeft } from "lucide-react";

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

export function SidebarNav<T extends Record<any, any>>({
  currentArea,
  areas,
  data,
}: {
  currentArea: string | null;
  areas: Record<string, SidebarNavArea<T>>;
  data: T;
}) {
  return (
    <div className="h-full w-[248px]">
      <nav className="size-full">
        <div className="size-full overflow-hidden rounded-none bg-[#fafafa] border-r border-[#EBEBEB] p-2">
          <div className="scrollbar-hide relative flex h-full flex-col overflow-y-auto overflow-x-hidden">
            <div className="relative flex grow flex-col  text-neutral-500">
              <div className="relative w-full grow">
                {areas &&
                  Object.entries(areas).map(([area, areaConfig]) => {
                    const { title, backHref, content } = areaConfig(data);

                    return (
                      <Area key={area} visible={area === currentArea}>
                        {title === "" && (
                          <div className="mb-4">
                            <WorkspaceDropdown />
                          </div>
                        )}
                        {title && (
                          <div className="mb-4 my-1 px-2">
                            {backHref ? (
                              <Link
                                href={backHref}
                                className="text-[13px] font-medium gap-x-2 flex items-center text-neutral-500 hover:text-neutral-600"
                              >
                                <ArrowLeft size={14} />{" "}
                                <span className="font-display text-[13.5px]">{title}</span>
                              </Link>
                            ) : (
                              <h2 className="text-sm font-medium font-display   text-neutral-700">
                                {title}
                              </h2>
                            )}
                          </div>
                        )}
                        <div className="space-y-1 ">
                          {content.map((item) => (
                            "heading" in item ? (
                              <div key={item.heading} className="px-1 my-4">
                                <h3 className="text-[12.5px] font-medium px-2 font-display text-neutral-500 tracking-wide mt-2 mb-2">
                                  {item.heading}
                                </h3>
                                <div className="space-y-1">
                                  {item.items.map((subItem) => (
                                    <NavItem key={subItem.href} item={subItem} />
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <NavItem key={item.href} item={item} />
                            )
                          ))}
                        </div>
                        {title == "" && (
                          <div className="mt-auto border-t border-[#EBEBEB] p-3 flex flex-col gap-4">
                            <h1 className="text-[12.5px] font-display font-medium">
                              Your workspace is on the free plan. Get in touch
                              with us for questions or feedback
                            </h1>
                            <Button
                              variant="secondary"
                              text=" Upgrade"
                              className="bg-[#F4F4F4] text-[#676767] h-fit py-1 text-sm rounded-full border-none"
                            ></Button>
                          </div>
                        )}
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

function NavItem({ item }: { item: NavItemType }) {
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
        "block rounded-none font-display font-medium py-0.5 px-2 text-[14.5px] text-neutral-600/85 transition-colors"
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
        "left-0 top-0 flex size-full flex-col transition-[opacity,transform] duration-300",
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

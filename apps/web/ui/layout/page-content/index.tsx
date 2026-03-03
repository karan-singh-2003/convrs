import { PageContentHeader } from "./page-content-header";
import { cn } from "@repo/utils";
import { PageContentHeaderProps } from "./page-content-header";

export function PageContent({
  children,
  headerProps,
}: {
  children: React.ReactNode;
  headerProps: PageContentHeaderProps;
}) {
  return (
    <div>
      <PageContentHeader {...headerProps}></PageContentHeader>
      <div className={cn("bg-white")}>{children}</div>
    </div>
  );
}

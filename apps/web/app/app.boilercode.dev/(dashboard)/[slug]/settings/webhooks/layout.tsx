import { PageContent } from "@/ui/layout/page-content";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
export default function WebhooksSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContent headerProps={{ title: "Webhooks" }}>
      <PageWidthWrapper>{children}</PageWidthWrapper>
    </PageContent>
  );
}

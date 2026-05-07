import { PageWithWrapper } from "@/ui/layout/page-with-wrapper";
import WorkspaceSettingsClient from "./page-client";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import { PageContent } from "@/ui/layout/page-content";

export default function workspaceSettings() {
  return (
    <PageWidthWrapper>
      <WorkspaceSettingsClient />
    </PageWidthWrapper>
  );
}

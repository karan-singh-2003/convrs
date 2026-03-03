import WorkspacePeopleClient from "./page-client";
import { PageContent } from "@/ui/layout/page-content";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";

export default function WorkspacePeople() {
  return (
    <PageWidthWrapper size="md">
      <WorkspacePeopleClient />
    </PageWidthWrapper>
  );
}

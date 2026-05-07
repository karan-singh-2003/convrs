import WorkspacePeopleClient from "./page-client";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";

export default function WorkspacePeople() {
  return (
    <PageWidthWrapper size="md">
      <WorkspacePeopleClient />
    </PageWidthWrapper>
  );
}

import WorkspacePeopleClient from "./page-client";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import { AnimatedSizeContainer } from "@repo/ui";

export default function WorkspacePeople() {
  return (
    <PageWidthWrapper>
      <AnimatedSizeContainer height>
        <WorkspacePeopleClient />
      </AnimatedSizeContainer>
    </PageWidthWrapper>
  );
}

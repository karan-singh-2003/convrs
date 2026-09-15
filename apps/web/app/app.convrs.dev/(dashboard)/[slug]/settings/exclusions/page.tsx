import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { TrackingFilters } from "../script/tracking-filters";
import { AnimatedSizeContainer } from "@repo/ui";

export default function ExclusionsPage() {
  return (
    <PageWidthWrapper>
      <AnimatedSizeContainer height>
        <SettingsChildrenLayout
          title="Exclusions"
          description="Manage your custom script configurations."
          className=""
        >
          <TrackingFilters />
        </SettingsChildrenLayout>
      </AnimatedSizeContainer>
    </PageWidthWrapper>
  );
}

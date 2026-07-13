import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { TrackingFilters } from "../script/tracking-filters";

export default function ExclusionsPage() {
    return (
        <PageWidthWrapper>
            <SettingsChildrenLayout
                title="Exclusions"
                description="Manage your custom script configurations."
                className=""
            >
                 <TrackingFilters />
            </SettingsChildrenLayout>

        </PageWidthWrapper>
    );
}
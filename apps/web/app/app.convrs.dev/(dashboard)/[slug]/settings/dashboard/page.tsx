"use client";

import { useDashboardCards } from "@/lib/analytics/use-dashboard-cards";
import useWorkspace from "@/lib/swr/use-workspace";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { AnimatedSizeContainer, Switch } from "@repo/ui";

export default function DashboardSettingsPage() {
  const { id: workspaceId } = useWorkspace();
  const { settings, updateSettings } = useDashboardCards(workspaceId);

  return (
    <PageWidthWrapper>
      <AnimatedSizeContainer height>
        <SettingsChildrenLayout
          title="Dashboard"
          description="Choose which cards appear on your website dashboard."
        >
          <SettingsChildrenLayout
            title="Bot Filtering"
            description="Show AI assistant, search engine indexing, and model training crawler traffic on the dashboard."
            className="mt-5"
            actions={
              <Switch
                checked={settings.botFiltering}
                trackDimensions="radix-state-checked:bg-black focus-visible:ring-black/20 w-7 h-4"
                thumbDimensions="size-3"
                thumbTranslate="translate-x-3"
                fn={(checked) => updateSettings({ botFiltering: checked })}
              />
            }
          >
            <div className="flex w-full items-center justify-between" />
          </SettingsChildrenLayout>
        </SettingsChildrenLayout>
      </AnimatedSizeContainer>
    </PageWidthWrapper>
  );
}

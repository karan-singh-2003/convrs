"use client";

import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import ScriptSettingsContent from "./script-settings-content";
import { TrackingFilters } from "./tracking-filters";
export default function ScriptSettingsPage() {
  return (
    <PageWidthWrapper>
      <SettingsChildrenLayout
        title="Script"
        description="Manage your custom script configurations."
        className=""
      >
        <div className="space-y-3">
          <ScriptSettingsContent />
          <TrackingFilters />
        </div>
      </SettingsChildrenLayout>
  
    </PageWidthWrapper>
  );
}

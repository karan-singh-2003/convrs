"use client";

import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import ScriptSettingsContent from "./script-settings-content";
import { TrackingFilters } from "./tracking-filters";
import { Timezone } from "./timezone";
import { AdditionalDomains } from "./additional-domains";
import ManagedProxy from "./managed-proxy";
import KPI from "./kpi";
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
          {/* <TrackingFilters /> */}
          <Timezone />
          {/* <AdditionalDomains />
          <ManagedProxy/> */}
          <KPI/>
        </div>
      </SettingsChildrenLayout>

    </PageWidthWrapper>
  );
}

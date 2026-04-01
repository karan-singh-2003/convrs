"use client";

import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { Button } from "@repo/ui";
export default function AlersSettingsPage() {
  return (
    <PageWidthWrapper>
      <SettingsChildrenLayout
        title="Alerts"
        description="Get Notified of important events and updates with our customizable alert system."
        actions={
          <Button
            text="Add Alert"
            className="text-black/60  bg-[#f3f4f6] h-fit font-display rounded-full text-[12.5px] py-1"
          />
        }
      >
        <div className="space-y-3 bg-white h-36 rounded-xl flex items-center justify-center font-medium text-sm font-display text-neutral-500">
          <h1>No alerts configured</h1>
        </div>
        <h1 className="font-display p-2 font-medium text-[13px] text-neutral-500">0/10 alerts used</h1>
      </SettingsChildrenLayout>
    </PageWidthWrapper>
  );
}

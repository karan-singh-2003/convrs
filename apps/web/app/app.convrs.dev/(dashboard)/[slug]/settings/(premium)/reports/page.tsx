"use client";

import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { Button, Switch } from "@repo/ui";
import { useState } from "react";
export default function ReportsSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  return (
    <PageWidthWrapper>
      <SettingsChildrenLayout
        title="Reports"
        description="Get weekly reports for your analytics data ."
      >
        <div className="bg-white p-4 rounded-xl space-y-5">
          <div className="flex  items-center justify-between">
            <h1 className="font-medium text-neutral-500 text-[15px] font-display">
              Weekly summary
            </h1>
            <Switch
              disabled={loading}
              checked={enabled || false}
              trackDimensions="radix-state-checked:bg-black focus-visible:ring-black/20 w-7 h-4"
              thumbDimensions="size-3"
              thumbTranslate="translate-x-3"
              fn={setEnabled}
            />
          </div>
          <div className="flex  items-center justify-between">
            <h1 className="font-medium text-neutral-500 text-[15px] font-display">
              Traffic spikes
            </h1>
            <Switch
              disabled={loading}
              checked={enabled || false}
              trackDimensions="radix-state-checked:bg-black focus-visible:ring-black/20 w-7 h-4"
              thumbDimensions="size-3"
              thumbTranslate="translate-x-3"
              fn={setEnabled}
            />
          </div>
        </div>
      </SettingsChildrenLayout>
    </PageWidthWrapper>
  );
}

"use client";

import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { Switch } from "@repo/ui";
import useSWR from "swr";
import { fetcher } from "@repo/utils";
import { useState } from "react";
import { toast } from "sonner";
import useWorkspace from "@/lib/swr/use-workspace";

type NotificationPreference = {
  weeklySummary: boolean;
  trafficSpikes: boolean;
};

export default function ReportsSettingsPage() {
  const { id: workspaceId } = useWorkspace();
  const { data, mutate } = useSWR<NotificationPreference>(
    workspaceId ? `/api/workspaces/${workspaceId}/notification-preferences` : null,
    fetcher
  );

  console.log("data in reports",data)

  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const updatePreference = async (
    key: keyof NotificationPreference,
    value: boolean
  ) => {
    setPendingKey(key);
    // optimistic update
    mutate({ ...data!, [key]: value }, false);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/notification-preferences`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: value }),
        }
      );
      if (!res.ok) throw new Error("Failed to update");
      await mutate();
    } catch (e) {
      toast.error("Failed to update preference");
      await mutate(); // revert to server state
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <PageWidthWrapper>
      <SettingsChildrenLayout
        title="Reports"
        description="Get weekly reports for your analytics data."
      >
        <div className="rounded-xl bg-white divide-y divide-neutral-100">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <h1 className="font-display text-[15px] font-medium text-neutral-600">
                Weekly summary
              </h1>
              <p className="text-[13px] font-display text-neutral-500">
                A recap of your clicks, revenue, and top links every Monday.
              </p>
            </div>
            <Switch
              disabled={!data || pendingKey === "weeklySummary"}
              checked={data?.weeklySummary ?? false}
              trackDimensions="radix-state-checked:bg-black focus-visible:ring-black/20 w-8 h-5"
              thumbDimensions="size-4"
              thumbTranslate="translate-x-3"
              fn={(checked: boolean) => updatePreference("weeklySummary", checked)}
            />
          </div>

          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <h1 className="font-display text-[15px] font-medium text-neutral-600">
                Traffic spikes
              </h1>
              <p className="text-[13px] font-display text-neutral-500">
                Get notified when your traffic spikes above normal.
              </p>
            </div>
            <Switch
              disabled={!data || pendingKey === "trafficSpikes"}
              checked={data?.trafficSpikes ?? false}
              trackDimensions="radix-state-checked:bg-black focus-visible:ring-black/20 w-8 h-5"
              thumbDimensions="size-4"
              thumbTranslate="translate-x-3"
              fn={(checked: boolean) => updatePreference("trafficSpikes", checked)}
            />
          </div>
        </div>
      </SettingsChildrenLayout>
    </PageWidthWrapper>
  );
}
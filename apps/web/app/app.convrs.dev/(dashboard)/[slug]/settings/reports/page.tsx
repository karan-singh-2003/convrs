"use client";

import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { AnimatedSizeContainer, Switch, Input } from "@repo/ui";
import useSWR from "swr";
import { fetcher } from "@repo/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import useWorkspace from "@/lib/swr/use-workspace";

type NotificationPreference = {
  weeklySummary: boolean;
  trafficSpikes: boolean;
  trafficSpikeThreshold: number;
};

export default function ReportsSettingsPage() {
  const { id: workspaceId } = useWorkspace();
  const { data: session } = useSession();
  const { data, mutate } = useSWR<NotificationPreference>(
    workspaceId
      ? `/api/workspaces/${workspaceId}/notification-preferences`
      : null,
    fetcher
  );

  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [thresholdInput, setThresholdInput] = useState("");

  useEffect(() => {
    if (data?.trafficSpikeThreshold != null) {
      setThresholdInput(String(data.trafficSpikeThreshold));
    }
  }, [data?.trafficSpikeThreshold]);

  const savePreference = async (
    patch: Partial<NotificationPreference>,
    key: string
  ) => {
    setPendingKey(key);
    // optimistic update
    mutate({ ...data!, ...patch }, false);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/notification-preferences`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
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

  const commitThreshold = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error("Threshold must be a positive number");
      return;
    }
    if (parsed === data?.trafficSpikeThreshold) return;
    savePreference({ trafficSpikeThreshold: parsed }, "trafficSpikeThreshold");
  };

  const recipientEmail = session?.user?.email;

  return (
    <PageWidthWrapper>
      <AnimatedSizeContainer height>
        <SettingsChildrenLayout
          title="Reports"
          description="Get weekly reports for your analytics data."
        >
          <div className="rounded-xl bg-bg-card divide-y divide-border-subtle">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display text-[15px] font-medium text-content-default">
                    Weekly summary
                  </h1>
                  <p className="text-[13px] font-display text-content-subtle">
                    A recap of your unique visitors, revenue, bounce rate, and
                    live visitors — sent every Monday.
                  </p>
                </div>
                <Switch
                  disabled={!data || pendingKey === "weeklySummary"}
                  checked={data?.weeklySummary ?? false}
                  trackDimensions="radix-state-checked:bg-neutral-900 dark:radix-state-checked:bg-neutral-100 focus-visible:ring-neutral-900/20 dark:focus-visible:ring-neutral-100/20 w-8 h-5"
             
                  thumbTranslate="translate-x-3"
                  fn={(checked: boolean) =>
                    savePreference({ weeklySummary: checked }, "weeklySummary")
                  }
                />
              </div>

              {data?.weeklySummary && (
                <div className="mt-3 space-y-1 rounded-lg bg-bg-emphasis/60 px-3 py-2.5">
                  <p className="text-[13px] font-display text-content-subtle">
                    You'll receive a weekly report every Monday.
                  </p>
                  <p className="text-[13px] font-display text-content-subtle">
                    We're sending reports to{" "}
                    <span className="font-medium text-content-default">
                      {recipientEmail ?? "your account email"}
                    </span>
                    .
                  </p>
                </div>
              )}
            </div>

            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display text-[15px] font-medium text-content-default">
                    Traffic spikes
                  </h1>
                  <p className="text-[13px] font-display text-content-subtle">
                    Get notified when your traffic spikes above normal.
                  </p>
                </div>
                <Switch
                  disabled={!data || pendingKey === "trafficSpikes"}
                  checked={data?.trafficSpikes ?? false}
                  trackDimensions="radix-state-checked:bg-neutral-900 dark:radix-state-checked:bg-neutral-100 focus-visible:ring-neutral-900/20 dark:focus-visible:ring-neutral-100/20 w-8 h-5"
                  // thumbDimensions="size-4"
                  thumbTranslate="translate-x-3"
                  fn={(checked: boolean) =>
                    savePreference({ trafficSpikes: checked }, "trafficSpikes")
                  }
                />
              </div>

              {data?.trafficSpikes && (
                <div className="mt-3 rounded-lg bg-bg-emphasis/60 px-3 py-2.5">
                  <label className="text-[13px] font-display font-medium text-content-default">
                    Alert threshold
                  </label>
                  <p className="mb-2 text-[13px] font-display text-content-subtle">
                    We'll only email you when visits in an hour exceed this
                    number and look statistically unusual. Default is 100.
                  </p>
                  <Input
                    type="number"
                    min={1}
                    className="max-w-[140px]"
                    disabled={!data || pendingKey === "trafficSpikeThreshold"}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    onBlur={(e) => commitThreshold(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </SettingsChildrenLayout>
      </AnimatedSizeContainer>
    </PageWidthWrapper>
  );
}

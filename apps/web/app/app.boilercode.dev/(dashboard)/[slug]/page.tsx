"use client";
import { Button } from "@repo/ui";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import Analytics from "@/ui/analytics";
import useWorkspace from "@/lib/swr/use-workspace";
import { useLiveVisitors } from "@/lib/analytics/use-live-visitors";

const DashboardPage = () => {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const { usageLimit, usage, subscriptionStatus, id,  } =
    useWorkspace();
    console.log("workspaceId in DashboardPage:", id);
  const { count: liveVisitorsCount } = useLiveVisitors(id ?? null);

  return (
    <>
      <PageWidthWrapper size={"full"}>
        <Analytics />
        {subscriptionStatus == "cancelled" && (
          <div className="relative">
            <div className="justify-center max-w-screen-lg mx-auto px-4 h-[500px]">
              <h1 className="font-default text-sm text-neutral-600">
                You have used {usage} of {usageLimit} events
              </h1>
            </div>

            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <div className="space-y-4">
                <div className="flex flex-col gap-y-1 text-center">
                  <h1 className="font-default text-base font-medium text-neutral-600">
                    Your trial has expired
                  </h1>
                  <h1 className="font-default text-[14.5px] font-medium text-neutral-500">
                    Pick a plan to view analytics for your websites
                  </h1>
                </div>
                <Button
                  text="Upgrade"
                  onClick={() => {
                    router.push(`/${slug}/settings/billing`);
                  }}
                  className="font-display font-medium w-fit px-10 mx-auto rounded-full"
                />
              </div>
            </div>
          </div>
        )}
      </PageWidthWrapper>
    </>
  );
};

export default DashboardPage;

"use client";
import { Button } from "@repo/ui";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageContent } from "@/ui/layout/page-content";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import Analytics from "@/ui/analytics";
import useWorkspace from "@/lib/swr/use-workspace";
import { PLANS } from "@repo/utils";
import { LowerGrid } from "@/ui/analytics/lower-grid";
import { AnalyticsFunnelChart } from "@/ui/analytics/analytics-funnel-chart";
import { useCreateFunnelModal } from "@/ui/modals/create-funnel-modal";

const DashboardPage = () => {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const { plan, usageLimit, usage, subscriptionStatus } = useWorkspace();
  const { setShowCreateFunnelModal, CreateFunnelModal } =
    useCreateFunnelModal();
  return (
    <>
      <CreateFunnelModal />
      <PageWidthWrapper size={"full"}>
        <Analytics />
        {subscriptionStatus !== "active" && (
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

        {/* <div className="h-[400px] bg-[#fafafa] w-full">
          <AnalyticsFunnelChart />
        </div>
        <div className="max-w-screen-lg mx-auto my-4">
          <button
            className="bg-black text-white font-medium font-display px-3 py-1 rounded-full"
            onClick={() => setShowCreateFunnelModal(true)}
          >
            Create funnel
          </button>
        </div> */}
      </PageWidthWrapper>
    </>
  );
};

export default DashboardPage;

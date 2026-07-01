"use client";
import { Button, LoadingSpinner, Progress } from "@repo/ui";
import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import Analytics from "@/ui/analytics";
import useWorkspace from "@/lib/swr/use-workspace";
import { useLiveVisitors } from "@/lib/analytics/use-live-visitors";
import Link from "next/link";
import useStripeIntegration from "@/lib/swr/use-stripe-integration";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useAttributionStatus } from "@/lib/swr/use-attribution";

const DashboardPage = () => {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const { usageLimit, usage, subscriptionStatus, id, loading } = useWorkspace();
  const { stripeIntegration } = useStripeIntegration();



  const { hasAttributedPayment } = useAttributionStatus(id);

  const steps = [
    { title: "Install script", completed: !!usage },
    {
      title: "Connect revenue",
      description: "See your sales and revenue directly in Convrs.",
      action: <Link href={`/${slug}/settings/revenue`}>Connect payment provider</Link>,
      completed: !!stripeIntegration,
    },
    {
      title: "Attribute payments",
      description: "A customer payment has been successfully attributed to a visitor session.",
      completed: hasAttributedPayment,  // ← reads from Postgres, not Tinybird
    },
  ];



  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  const completedSteps = steps.filter((s) => s.completed).length;
  return (
    <>
      <PageWidthWrapper size={"full"}>
        <>
          {subscriptionStatus == "inactive" ? (
            <div className="relative">
              <div className="justify-center max-w-screen-lg mx-auto px-4 h-[500px]">
                {/* <h1 className="font-default text-sm text-neutral-600">
                    You have used {usage} of {usageLimit} events
                  </h1> */}
              </div>

              <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                <div className="space-y-4">
                  <div className="flex flex-col gap-y-1 text-center">
                    <h1 className="font-default text-base font-medium text-neutral-600">
                      You dont have an active subscription
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
          ) :
            <div className="relative">
              <Analytics mode="private" workspaceId={id} />

              <div className="relative">


                <div className="fixed bottom-5 px-5 py-3.5 left-5 z-30 w-[430px] rounded-xl border border-neutral-200 bg-neutral-50  shadow-xl font-display">

                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[14px] font-medium text-neutral-600">
                        Finish setting up Convrs
                      </h2>

                      <p className="mt-0.5 text-[13px] font-display text-neutral-500">
                        {completedSteps}/{steps.length} completed
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="rounded-full p-1 text-neutral-500 transition hover:bg-neutral-100"
                      >
                        {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      <button
                        onClick={() => setHidden(true)}
                        className="rounded-full p-1 text-neutral-500 transition hover:bg-neutral-100"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {!collapsed && (
                    <>
                      <Progress
                        value={(completedSteps / steps.length) * 100}
                        className="mt-3 h-1.5"
                      />

                      <div className="mt-4 space-y-3">
                        {steps.map((step, index) => {
                          const active =
                            !step.completed &&
                            index === steps.findIndex((s) => !s.completed);

                          return (
                            <div key={step.title} className="flex gap-3">
                              {step.completed ? (
                                <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-neutral-700 text-white">
                                  <Check size={10} strokeWidth={3.5} />
                                </div>
                              ) : active ? (
                                <div className="flex h-[16px] w-[16px] items-center justify-center rounded-full border border-dashed border-neutral-400">
                                  {/* <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-neutral-600" /> */}
                                </div>
                              ) : (
                                <div className="h-[18px] w-[18px] rounded-full border border-neutral-300 bg-white" />
                              )}

                              <div className="flex-1">
                                <p className="text-[13px] font-medium text-neutral-700">
                                  {step.title}
                                </p>

                                {step.description && (
                                  <p className="mt-0.5 text-[12.5px] leading-5 text-neutral-500">
                                    {step.description}
                                  </p>
                                )}

                                {step.action && (
                                  <div className="mt-1 text-[12px] font-medium text-neutral-600 underline">
                                    {step.action}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          }
        </>
      </PageWidthWrapper>
    </>
  );
};

export default DashboardPage;

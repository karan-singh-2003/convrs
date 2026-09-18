"use client";
import { Button, LoadingSpinner } from "@repo/ui";
import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import Analytics from "@/ui/analytics";
import useWorkspace from "@/lib/swr/use-workspace";
import { useLiveVisitors } from "@/lib/analytics/use-live-visitors";
import { useTheme } from "next-themes";

const DashboardPage = () => {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const { usageLimit, usage, subscriptionStatus, id, loading, name } = useWorkspace();

  const { theme, resolvedTheme, systemTheme } = useTheme();


  useEffect(() => {

    // If you're using the ThemeScope wrapper approach, also check the scoped div:

  }, [theme, resolvedTheme, systemTheme]);

  return (
    <>
      <PageWidthWrapper size={"full"}>
        <>
          {subscriptionStatus == "inactive" ? (
            <div className="relative">
              <div className="justify-center max-w-screen-lg mx-auto px-4 h-[500px]" />

              <div className="absolute inset-0 flex items-center justify-center bg-bg-default">
                <div className="space-y-4">
                  <div className="flex flex-col gap-y-1 text-center">
                    <h1 className="font-default text-base font-medium text-content-default">
                      You dont have an active subscription
                    </h1>
                    <h1 className="font-default text-[14.5px] font-medium text-content-subtle">
                      Pick a plan to view analytics for your websites
                    </h1>
                  </div>
                  <Button
                    text="Upgrade"
                    onClick={() => {
                      router.push(`/${slug}/billing`);
                    }}
                    className="font-display font-medium w-fit px-10 mx-auto rounded-full"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <Analytics mode="private" workspaceId={id} workspaceName={name} />
            </div>
          )}
        </>
      </PageWidthWrapper>
    </>
  );
};

export default DashboardPage;
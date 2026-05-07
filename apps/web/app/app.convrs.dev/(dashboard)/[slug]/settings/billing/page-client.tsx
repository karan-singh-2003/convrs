// "use client";
// import React, { useMemo, useState } from "react";
// import { Button } from "@repo/ui";
// import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
// import IsometricBoxes from "./IsometricBoxes";
// import Invoices from "./Invoices";
// import useWorkspace from "@/lib/swr/use-workspace";
// import useSWR from "swr";
// import { fetcher } from "@repo/utils";
// import { getFormattedBillingPeriod } from "@repo/utils";
// import { toast } from "sonner";
// import { useCreateWorkspaceModal } from "@/ui/modals/upgrade-plan-modal";

// type BillingData = {
//   billingCycle: "monthly" | "yearly";
//   billingPeriodStart: number;
// };
// const BillingClient = () => {
//   const [isOpeningPortal, setIsOpeningPortal] = useState(false);
//   const {
//     slug,
//     plan: workspacePlan,
//     loading,
//     freeTrialEndDate,
//     subscriptionStatus,
//   } = useWorkspace();

//   const { setShowUpgradePlanModal, UpgradePlanModal } =
//     useCreateWorkspaceModal();

//   const planName = workspacePlan ?? "Free";

//   const { data, isLoading } = useSWR<BillingData>(
//     `/api/workspaces/${slug}/billing`,
//     fetcher
//   );

//   const billingInterval = data?.billingCycle;
//   const billingStartDate = data?.billingPeriodStart;

//   const billingPeriod = useMemo(
//     () =>
//       getFormattedBillingPeriod(
//         billingStartDate ? billingStartDate * 1000 : undefined, // ← fix
//         billingInterval
//       ),
//     [billingStartDate, billingInterval]
//   );
//   const [billingStart, billingEnd] = billingPeriod ?? [];

//   const handleManageSubscription = async () => {
//     if (!slug || isOpeningPortal) return;

//     setIsOpeningPortal(true);

//     try {
//       const res = await fetch(`/api/workspaces/${slug}/billing/manage`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//       });

//       if (!res.ok) {
//         const body = await res.json().catch(() => ({}));
//         if (body?.error === "No Stripe customer found") {
//           setShowUpgradePlanModal(true);
//           return;
//         }

//         throw new Error(body?.error || "Failed to open billing portal");
//       }

//       const body = (await res.json()) as { url?: string };
//       if (!body.url) {
//         throw new Error("Missing billing portal URL");
//       }

//       window.location.assign(body.url);
//     } catch (error) {
//       toast.error(
//         error instanceof Error ? error.message : "Failed to open billing portal"
//       );
//     } finally {
//       setIsOpeningPortal(false);
//     }
//   };

//   return (
//     <>
//       <UpgradePlanModal />
//       <div className="space-y-6">
//         <SettingsChildrenLayout
//           title="Billing"
//           description="For questions about Billing Contact Us"
//           className="px-3 lg:px-8"
//           actions={
//             <>
//               <Button
//                 variant="secondary"
//                 text="Upgrade"
//                 className="text-sm w-fit h-fit py-1 text-neutral-500"
//                 onClick={() => setShowUpgradePlanModal(true)}
//               />
//             </>
//           }
//         >
//           <div className="bg-white rounded-xl border border-neutral-200">
//             <div className="space-y-0.5 px-3.5 py-2.5 ">
//               <h3 className="text-sm font-medium font-display text-neutral-500">
//                 Current Plan
//               </h3>
//               <p className="text-[13.5px] font-display text-neutral-500">
//                 {subscriptionStatus === "trialing"
//                   ? `14 days Free Trial (${freeTrialEndDate ? `ends on ${new Date(freeTrialEndDate).toLocaleDateString()}` : "loading..."})`
//                   : billingStart && billingEnd
//                     ? `Renews on ${billingEnd}`
//                     : "No active subscription"}
//               </p>
//             </div>
//             <div className="flex items-center gap-x-3 px-3 py-2.5 border-t border-neutral-200/70   ">
//               {/* <IsometricBoxes count={getCount(planName)} size={39} /> */}
//               <div className="flex flex-col px-1">
//                 <p className="text-[14px] font-medium font-display text-neutral-500">
//                   {loading ? "" : planName}
//                 </p>
//                 {/* <p className="text-[14px] font-display text-neutral-500">
//                 {loading ? "..." : formatPrice(price ?? 0, interval)}
//               </p> */}
//               </div>
//               {planName.toLowerCase() !== "enterprise" && (
//                 <Button
//                   text="Manage"
//                   loading={isOpeningPortal}
//                   variant="secondary"
//                   className="ml-auto rounded-full h-fit bg-[#EDF3FF] text-[#3A8ED3] text-[12.5px] py-1 px-3 w-fit font-default"
//                   onClick={handleManageSubscription}
//                 />
//               )}
//             </div>
//           </div>
//         </SettingsChildrenLayout>

//         {/* Recent Invoices */}
//         {/* <SettingsChildrenLayout
//           title="Recent Invoices"
//           description="View and track your past invoices and payment history"
//           className="my-5 px-3 lg:px-8"
//           actions={<></>}
//         >
//           <Invoices />
//         </SettingsChildrenLayout> */}
//       </div>
//     </>
//   );
// };

// export default BillingClient;

// function getCount(planName: string) {
//   switch (planName.toLowerCase()) {
//     case "pro":
//       return 2;
//     case "business":
//       return 3;
//     case "advanced":
//       return 4;
//     case "enterprise":
//       return 4;
//     default:
//       return 1;
//   }
// }

"use client";
import React, { useMemo, useState } from "react";
import { Button } from "@repo/ui";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import useWorkspace from "@/lib/swr/use-workspace";
import useSWR from "swr";
import { fetcher } from "@repo/utils";
import { getFormattedBillingPeriod } from "@repo/utils";
import { toast } from "sonner";
import { useCreateWorkspaceModal } from "@/ui/modals/upgrade-plan-modal";

type BillingData = {
  billingCycle: "monthly" | "yearly";
  billingPeriodStart: number;
};

const BillingClient = () => {
  // Format a number as 5M, 500k, 50k, etc.
  function formatCompactNumber(value: number | undefined): string {
    if (value === undefined) return "";
    if (value >= 1_000_000)
      return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
    if (value >= 1_000)
      return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
    return value.toString();
  }
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const {
    slug,
    plan: workspacePlan,
    loading,
    freeTrialEndDate,
    subscriptionStatus,
    usageLimit,
  } = useWorkspace();

  const { setShowUpgradePlanModal, UpgradePlanModal } =
    useCreateWorkspaceModal();

  const planName = workspacePlan ?? "Free";

  const { data, isLoading } = useSWR<BillingData>(
    slug ? `/api/workspaces/${slug}/billing` : null,
    fetcher
  );

  console.log("Billing data:", data, "Loading:", isLoading);
  const billingInterval = data?.billingCycle;
  const billingStartDate = data?.billingPeriodStart;

  const billingPeriod = useMemo(
    () =>
      getFormattedBillingPeriod(
        billingStartDate ? billingStartDate * 1000 : undefined,
        billingInterval
      ),
    [billingStartDate, billingInterval]
  );

  const [billingStart, billingEnd] = billingPeriod ?? [];

  const handleManageSubscription = async () => {
    if (!slug || isOpeningPortal) return;

    setIsOpeningPortal(true);

    try {
      const res = await fetch(`/api/workspaces/${slug}/billing/manage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));

        // "No customer found" covers both legacy Stripe and new Dodo error messages.
        // Keep this in sync with whatever error string your /manage route returns.
        const errMsg: string = body?.error ?? "";
        if (
          errMsg === "No customer found" ||
          errMsg === "No Stripe customer found" ||
          errMsg === "No Dodo customer found"
        ) {
          toast.error(
            "No active subscription found. Please choose a plan to subscribe."
          );
          setShowUpgradePlanModal(true);
          return;
        }

        throw new Error(errMsg || "Failed to open billing portal");
      }

      const body = (await res.json()) as { url?: string };
      if (!body.url) {
        throw new Error("Missing billing portal URL");
      }

      window.location.assign(body.url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to open billing portal"
      );
    } finally {
      setIsOpeningPortal(false);
    }
  };

  return (
    <>
      <UpgradePlanModal />
      <div className="space-y-6">
        <SettingsChildrenLayout
          title="Billing"
          description="For questions about Billing Contact Us"
          className="px-3 lg:px-8"
          actions={
            <Button
              variant="secondary"
              text="Upgrade"
              className="text-sm w-fit h-fit py-1 text-neutral-500"
              onClick={() => setShowUpgradePlanModal(true)}
            />
          }
        >
          <div className="bg-white rounded-xl border border-neutral-200">
            <div className="space-y-0.5 px-3.5 py-2.5">
              <h3 className="text-sm font-medium font-display text-neutral-500">
                Current Plan
              </h3>
              <p className="text-[13.5px] font-display text-neutral-500">
                {subscriptionStatus === "trialing"
                  ? `14 days Free Trial (${
                      freeTrialEndDate
                        ? `ends on ${new Date(freeTrialEndDate).toLocaleDateString()}`
                        : "loading..."
                    })`
                  : isLoading
                    ? "Loading..."
                    : billingStart && billingEnd
                      ? `Renews on ${billingEnd}`
                      : "No active subscription"}
              </p>
            </div>

            <div className="flex items-center gap-x-3 px-3 py-2.5 border-t border-neutral-200/70">
              <div className="flex items-center gap-x-1 px-1">
                <p className="text-[14px] font-medium font-display text-neutral-500">
                  {loading ? "" : planName}
                </p>
                <span className="text-[13px] font-display text-neutral-500">
                  {usageLimit !== undefined
                    ? ` (${formatCompactNumber(usageLimit)} monthly events)`
                    : ""}
                </span>
              </div>

              {planName.toLowerCase() !== "enterprise" && (
                <Button
                  text="Manage"
                  loading={isOpeningPortal}
                  variant="secondary"
                  className="ml-auto rounded-full h-fit bg-[#EDF3FF] text-[#3A8ED3] text-[12.5px] py-1 px-3 w-fit font-default"
                  onClick={handleManageSubscription}
                />
              )}
            </div>
          </div>
        </SettingsChildrenLayout>
      </div>
    </>
  );
};

export default BillingClient;

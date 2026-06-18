"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { getFreeTrialInfo } from "@/lib/api/workspaces/check-free-trial-days-left";
import { Button } from "@repo/ui";
import { useRouter } from "next/navigation";

export function FreeTrialBanner() {
    const {
        subscriptionStatus,
        freeTrialEndDate,
        slug,
    } = useWorkspace();

    const router = useRouter();

    if (!freeTrialEndDate) {
        return null;
    }

    const trial = getFreeTrialInfo(freeTrialEndDate);

    // Expired trial
    if (trial.isExpired) {
        return (
            <div className="fixed top-0 left-0 z-[60] w-full bg-amber-50 border-b">
                <div className="mx-auto flex h-11 max-w-screen-lg items-center justify-between px-4">
                    <p className="text-sm font-medium text-red-900">
                        Your free trial has ended. Upgrade to continue using Convrs.
                    </p>

                    <Button
                        text="Upgrade"
                        onClick={() =>
                            router.push(`/${slug}/settings/billing`)
                        }
                    />
                </div>
            </div>
        );
    }

    // Only show active trial banner for trialing users
    if (subscriptionStatus === "inactive") {
        return (
            <div className="fixed top-0 left-0 z-[60] w-full bg-amber-50 border-b">
                <div className="mx-auto flex h-11 max-w-screen-lg items-center justify-between px-4">
                    <p className="text-sm font-medium text-red-900">
                        Your have Inactive Subscription. Upgrade to continue using Convrs.
                    </p>

                    <Button
                        text="Upgrade"
                        onClick={() =>
                            router.push(`/${slug}/settings/billing`)
                        }
                    />
                </div>
            </div>
        );
    }

    let message = `${trial.daysLeft} days left in your free trial.`;

    if (trial.daysLeft === 1) {
        message = "Your free trial ends tomorrow.";
    } else if (trial.daysLeft <= 3) {
        message = `Only ${trial.daysLeft} days left in your free trial.`;
    }

    return (
        // <div
        //   className={
        //     trial.daysLeft <= 3
        //       ? "border-b border-red-200 bg-red-50"
        //       : "border-b border-amber-200 bg-amber-50"
        //   }
        // >
        //   <div className="mx-auto flex h-11 max-w-screen-lg items-center justify-between px-4">
        //     <p
        //       className={
        //         trial.daysLeft <= 3
        //           ? "text-sm font-medium text-red-900"
        //           : "text-sm font-medium text-amber-900"
        //       }
        //     >
        //       {message}
        //     </p>

        //     <Button
        //       text="Upgrade"
        //       onClick={() =>
        //         router.push(`/${slug}/settings/billing`)
        //       }
        //     />
        //   </div>
        // </div>
        <div className="fixed top-0 left-0 z-[60] w-full bg-amber-50 border-b">
            red banner
        </div>
    );
}
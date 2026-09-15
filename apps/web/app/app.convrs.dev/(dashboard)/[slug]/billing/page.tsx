"use client";

import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { APP_DOMAIN, type PricingFamily } from "@repo/utils";
import { AnimatedSizeContainer } from "@repo/ui";
import useWorkspace from "@/lib/swr/use-workspace";
import { BILLING_V2 } from "@/lib/billing/flags";
import { BillingPageV2 } from "./billing-v2";

// The billing page lived at /{slug}/settings/billing before; its functional
// logic (checkout via /api/workspaces/{slug}/billing/upgrade, loading/error
// handling) is preserved here while this route owns the UI.
//
// Deploy 3b: NEXT_PUBLIC_BILLING_V2 swaps in the rebuilt subscription UI
// (billing-v2.tsx). Flag off → this legacy page renders unchanged.

export default function BillingPage() {
  if (BILLING_V2) return <BillingPageV2 />;
  return <LegacyBillingPage />;
}

function LegacyBillingPage() {
  const router = useRouter();
  const { slug, loading, error } = useWorkspace();

  return (
    <div className="px-2 max-w-3xl mx-auto">
      <h1
        onClick={() => router.push(slug ? `/${slug}` : "/")}
        className="flex items-center gap-2 font-poppins text-sm text-content-default cursor-pointer"
      >
        <ArrowLeft size={15} />
        Back
      </h1>

      <h1 className="font-poppins text-xl text-content-default mt-5">
        Billing
      </h1>

      <AnimatedSizeContainer height>
        {error ? (
          <p className="mt-16 text-center font-poppins text-sm text-content-subtle">
            Failed to load billing details. Please refresh and try again.
          </p>
        ) : loading ? (
          <div className="mt-20 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-content-subtle" />
          </div>
        ) : (
          <div className="flex max-w-2xl mx-auto flex-col md:flex-row items-center gap-10 mt-10">
            {/* Standard */}
            <div className="bg-bg-emphasis rounded-[40px] w-full md:w-1/2 min-h-[500px] p-6 flex flex-col">
              <h1 className="font-poppins text-[13px] text-content-subtle">
                STANDARD
              </h1>

              <h2 className="font-alexandria text-3xl mt-2">
                $0{" "}
                <span className="text-[13px] text-content-subtle">
                  then $9/month in 8 days
                </span>
              </h2>

              <div className="mt-8 space-y-3">
                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />
                  0k monthly events
                </p>

                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />
                  30 websites
                </p>

                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />
                  30 team members
                </p>

                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />
                  5+ years of data retention
                </p>

                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />
                  AI bot traffic
                </p>

                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />
                  API, CLI & MCP
                </p>
              </div>

              <PickPlanButton family="standard" />

              <p className="text-[12px] mt-1 text-center font-display text-content-subtle">
                No charge until free trial ends in 8 days
              </p>
            </div>

            {/* Growth */}
            <div className="bg-bg-emphasis rounded-[40px] w-full md:w-1/2 min-h-[500px] p-6 flex flex-col">
              <h1 className="font-poppins text-[13px] text-content-subtle">
                GROWTH
              </h1>

              <h2 className="font-alexandria text-3xl mt-2">
                $0{" "}
                <span className="text-[13px] text-content-subtle">
                  then $19/month in 8 days
                </span>
              </h2>

              <div className="mt-8 space-y-3">
                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />
                  0k monthly events
                </p>

                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />
                  30 websites
                </p>

                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />
                  30 team members
                </p>

                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />
                  5+ years of data retention
                </p>

                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />
                  AI bot traffic
                </p>

                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />
                  API, CLI & MCP
                </p>

                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />
                  Social media mentions
                </p>

                <p className="flex items-center gap-2 font-poppins text-sm text-content-default">
                  <Check size={15} />X links attribution
                </p>
              </div>

              <PickPlanButton family="growth" />

              <p className="text-[12px] mt-1 text-center font-display text-content-subtle">
                No charge until free trial ends in 8 days
              </p>
            </div>
          </div>
        )}
      </AnimatedSizeContainer>
    </div>
  );
}

// Both cards in the new UI map to the entry ("Starter") tier of their pricing
// family — Standard vs. Growth. The checkout / change-plan flow itself is the
// same one the old settings/billing page and the upgrade modal use.
const ENTRY_TIER = "Starter";
const BILLING_PERIOD = "monthly" as const;

function PickPlanButton({ family }: { family: PricingFamily }) {
  const { slug, plan: currentPlan, planFamily: currentFamily } = useWorkspace();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  const isCurrentPlan =
    currentPlan?.toLowerCase() === ENTRY_TIER.toLowerCase() &&
    ((currentFamily as PricingFamily) ?? "standard") === family;

  async function handlePick() {
    if (!slug || loading || isCurrentPlan) return;

    setLoading(true);

    const queryString = searchParams.toString();
    const baseUrl = `${APP_DOMAIN}${pathname}${queryString ? `?${queryString}` : ""}`;

    try {
      const res = await fetch(`/api/workspaces/${slug}/billing/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: ENTRY_TIER,
          family,
          period: BILLING_PERIOD,
          baseUrl,
          onboarding: searchParams.get("workspace") ? "true" : "false",
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(body?.error || "Failed to start checkout");
      }

      if (body?.url) {
        window.location.assign(body.url);
        return;
      }

      toast.success("Your plan has been updated!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start checkout"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePick}
      disabled={loading || isCurrentPlan}
      className="mt-auto flex w-full items-center justify-center gap-2 rounded-full bg-[#ffffff] py-3 text-sm font-poppins font-medium text-neutral-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {isCurrentPlan ? "Current plan" : "Pick this plan"}
    </button>
  );
}

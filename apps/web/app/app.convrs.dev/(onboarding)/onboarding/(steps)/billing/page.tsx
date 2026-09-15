import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BILLING_V2 } from "@/lib/billing/flags";
import { BillingForm } from "./form";

// Deploy 3b — the first-subscription choice in onboarding. Only part of the flow
// under NEXT_PUBLIC_BILLING_V2 (the workspace step routes here); with the flag
// off the workspace step goes straight to Script, and a direct hit here is
// bounced along so the legacy flow is unchanged.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  if (!BILLING_V2) {
    const { workspace } = await searchParams;
    redirect(workspace ? `/onboarding/script?workspace=${workspace}` : "/onboarding/script");
  }

  return (
    <Suspense fallback={<div>Loading…</div>}>
      <div className="relative mx-auto flex h-fit w-full max-w-2xl flex-col items-center px-4 pt-16 sm:px-6">
        <h1 className="text-center font-display text-base font-semibold text-neutral-600 sm:text-[18px]">
          Choose your plan
        </h1>
        <h3 className="text-center font-display text-sm font-medium text-muted-foreground sm:text-[14.5px]">
          One subscription covers one website. You can change or cancel anytime.
        </h3>
        <div className="my-6 w-full">
          <BillingForm />
        </div>
      </div>
    </Suspense>
  );
}

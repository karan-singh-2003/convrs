import { Suspense } from "react";
import { BillingForm } from "./form";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <div className="flex flex-col items-center top-16 relative h-fit max-w-5xl mx-auto px-4">
        <h1 className="font-display text-neutral-600 font-semibold text-[18px]">
          Choose Your Plan
        </h1>
        <h3 className="text-muted-foreground font-medium font-display text-center text-[14.5px]">
          Select a plan that works best for you and your team.
        </h3>
        <div className="my-6 w-full">
          <BillingForm />
        </div>
      </div>
    </Suspense>
  );
}

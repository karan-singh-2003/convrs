import { redirect } from "next/navigation";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import { BILLING_V2 } from "@/lib/billing/flags";
import { SubscriptionsPageClient } from "./page-client";

// Deploy 3b — account-level home for cross-workspace billing (there is no
// Organization entity; a user just owns many Subscriptions). Gated: with
// NEXT_PUBLIC_BILLING_V2 off this route redirects to account settings so the
// pre-Deploy-3b surface is unchanged.
export default function Page() {
  if (!BILLING_V2) redirect("/account/settings");
  return (
    <PageWidthWrapper size="md">
      <SubscriptionsPageClient />
    </PageWidthWrapper>
  );
}

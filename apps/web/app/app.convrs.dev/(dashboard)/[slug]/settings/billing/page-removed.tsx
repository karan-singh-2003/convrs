import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import React from "react";
import BillingClient from "./page-client";
export default function Billing(){
  return (
    <PageWidthWrapper size="md">
      <BillingClient></BillingClient>
    </PageWidthWrapper>
  )
}
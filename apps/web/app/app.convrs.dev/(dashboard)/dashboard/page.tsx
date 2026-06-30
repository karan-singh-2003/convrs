"use client";

import DashboardGraph from "./graph";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import DashboardPageClient from "./page-client";

export default function DashboardPage() {
  return (
    <PageWidthWrapper size="lg">
      <DashboardPageClient />
    </PageWidthWrapper>
  );
}
    
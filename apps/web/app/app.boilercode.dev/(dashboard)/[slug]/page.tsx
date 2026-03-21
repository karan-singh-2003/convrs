"use client";
import { Button } from "@repo/ui";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageContent } from "@/ui/layout/page-content";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import Analytics from "@/ui/analytics";

const DashboardPage = () => {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  return (
    <PageWidthWrapper size={"lg"} >
      <Analytics />
    </PageWidthWrapper>
  );
};

export default DashboardPage;

"use client";
import { Button } from "@repo/ui";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PageContent } from "@/ui/layout/page-content";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";

const DashboardPage = () => {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  return (
    <PageWidthWrapper>
      <div></div>
    </PageWidthWrapper>
  );
};

export default DashboardPage;

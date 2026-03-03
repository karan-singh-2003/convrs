import React from "react";
import { SettingsPageClient } from "./page-client";
import { PageWithWrapper } from "@/ui/layout/page-with-wrapper";
import { PageContent } from "@/ui/layout/page-content";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
const page = () => {
  return (
    <PageWidthWrapper size="md" >
      <SettingsPageClient />
    </PageWidthWrapper>
  );
};

export default page;

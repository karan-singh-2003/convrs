"use client";

import React from "react";
import { SAML } from "./saml";
import { SCIM } from "./scim";
import { PageContent } from "@/ui/layout/page-content";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { Switch } from "@repo/ui";

const page = () => {
  const [enabled, setEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  return (
    <PageWidthWrapper>
      <SettingsChildrenLayout
        title="Security"
        description="Manage authentication methods, configure SAML SSO, and control user provisioning with SCIM."
        className=""
      >
        <div className="space-y-5 ">
          <SAML />
          <SCIM />
        </div>
      </SettingsChildrenLayout>
      <SettingsChildrenLayout
        title="Attack Mode"
        description="Attack mode enables additional security protections to help protect your analytics from spam if you site is under attack"
        className="mt-5"
        actions={
          <Switch
            disabled={loading}
            checked={enabled || false}
            trackDimensions="radix-state-checked:bg-black focus-visible:ring-black/20 w-7 h-4"
            thumbDimensions="size-3"
            thumbTranslate="translate-x-3"
            fn={setEnabled}
          />
        }
      >
        <div className="flex justify-between items-center w-full">

        </div>
      </SettingsChildrenLayout>
    </PageWidthWrapper>
  );
};

export default page;

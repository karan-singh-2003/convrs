import React from "react";
import { SAML } from "./saml";
import { SCIM } from "./scim";
import { PageContent } from "@/ui/layout/page-content";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";

const page = () => {
  return (
    <PageWidthWrapper>
      <SettingsChildrenLayout
        title="Security"
        description="Manage authentication methods, configure SAML SSO, and control user provisioning with SCIM."
        className="my-5"
      >
        <div className="space-y-5 ">
          <SAML />
          <SCIM />
        </div>
      </SettingsChildrenLayout>
    </PageWidthWrapper>
  );
};

export default page;

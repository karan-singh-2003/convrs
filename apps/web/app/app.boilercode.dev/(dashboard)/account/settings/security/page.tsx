import React from "react";
import { PageContent } from "@/ui/layout/page-content";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import { TwoFactorAuth } from "./two-factor-auth";
import Passkey from "./passkey";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
const page = () => {
  return (
    <PageWidthWrapper size="lg">
      <SettingsChildrenLayout
        title="Security "
        description="Manage your password and two-factor authentication."
        className="py-5"
      >
        <div className="space-y-6 my-4">
          <TwoFactorAuth />
          <Passkey />
        </div>
      </SettingsChildrenLayout>
    </PageWidthWrapper>
  );
};

export default page;

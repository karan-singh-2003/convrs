import React from "react";
import { PageContent } from "@/ui/layout/page-content";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import { TwoFactorAuth } from "./two-factor-auth";
import Passkey from "./passkey";
import Password from "./password";
import Sessions from "./sessions";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
const page = () => {
  return (
    <PageWidthWrapper size="md">
      <SettingsChildrenLayout
        title="Security "
        description="Manage your password and two-factor authentication."
        className="py-5"
      >
        <div className="space-y-6 ">
          <Password />
          <Passkey />
          <TwoFactorAuth />
        </div>
      </SettingsChildrenLayout>
      <SettingsChildrenLayout
        title="Security "
        description="Manage devices where you’re signed in"
        className="py-5"
        actions={[]}
      >
        <Sessions />
      </SettingsChildrenLayout>
    </PageWidthWrapper>
  );
};

export default page;

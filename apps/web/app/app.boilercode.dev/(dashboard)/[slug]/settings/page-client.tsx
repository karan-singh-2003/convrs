"use client";

import DeleteWorkspace from "@/ui/workspaces/delete-workspace";
import UploadLogo from "@/ui/workspaces/upload-logo";
import UpdateWorkspaceName from "@/ui/workspaces/update-workspace-name";
import UpdateWorkspaceSlug from "@/ui/workspaces/update-workspace-slug";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";

export default function WorkspaceSettingsClient() {
  return (
    <div className="flex flex-col gap-8 my-4">
      <SettingsChildrenLayout
        title="General"
        description="Change your organization name and URL, set up custom email settings, or request Typeform data."
        className="my-5"
      >
        <div className="space-y-7">
        
          <UpdateWorkspaceName />
          <UpdateWorkspaceSlug />
          <UploadLogo />
          <DeleteWorkspace />
        </div>
      </SettingsChildrenLayout>
    </div>
  );
}

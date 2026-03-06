"use client";

import DeleteWorkspace from "@/ui/workspaces/delete-workspace";
import UploadLogo from "@/ui/workspaces/upload-logo";
import UpdateWorkspaceName from "@/ui/workspaces/update-workspace-name";
import UpdateWorkspaceSlug from "@/ui/workspaces/update-workspace-slug";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { clientAccessCheck } from "@/lib/client-access-check";
import useWorkspace from "@/lib/swr/use-workspace";

export default function WorkspaceSettingsClient() {
  const { role } = useWorkspace();
  const permissionError = clientAccessCheck({
    action: "workspace:write",
    role,
  });
  return (
    <div className="flex flex-col gap-8 my-4">
      <SettingsChildrenLayout
        title="General"
        description="Change your organization name and URL, set up custom email settings, or request Typeform data."
        className="md:my-5"
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

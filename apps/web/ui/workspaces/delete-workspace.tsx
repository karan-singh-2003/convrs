import { Button, TooltipProvider } from "@repo/ui";
import { useDeleteWorkspaceModal } from "@/ui/modals/delete-workspace-modal";
import { clientAccessCheck } from "@/lib/client-access-check";
import useWorkspace from "@/lib/swr/use-workspace";

export default function DeleteWorkspace() {
  const { setShowDeleteWorkspaceModal, DeleteWorkspaceModal } =
    useDeleteWorkspaceModal();

  const { role } = useWorkspace();

  const permissionError = clientAccessCheck({
    action: "workspace:write",
    role,
  }).error;

  return (
    <TooltipProvider>
      <div>
        <DeleteWorkspaceModal />

        <div className="rounded-2xl border border-border-subtle bg-bg-default p-4 space-y-2">
          <div className="space-y-0.5 font-display">
            <h2 className="text-sm font-medium text-content-default">
              Delete Workspace
            </h2>

            <p className="text-[13px] font-default text-content-subtle">
              Permanently delete your workspace and all associated data. This
              action cannot be undone, so please proceed with caution.
            </p>
          </div>

          <Button
            text="Delete Workspace"
            variant="danger"
            className="h-fit w-fit py-1 text-[13px] font-display"
            onClick={() => setShowDeleteWorkspaceModal(true)}
            disabledTooltip={permissionError || undefined}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
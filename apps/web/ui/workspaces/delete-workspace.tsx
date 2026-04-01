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
        <div className="bg-white border border-neutral-200 p-4 rounded-xl">
          <div className="space-y-0.5">
            <h2 className="font-medium text-sm font-display text-neutral-600">
              Delete Workspace
            </h2>
            <p className="font-display text-[14px] text-neutral-500">
              Permanently delete your workspace, and all associated data. This
              action cannot be undone - please proceed with caution.
            </p>
          </div>
          <div className="mt-3 ">
            <Button
              text="Delete Workspace"
              variant="danger"
              className="w-fit text-[13px] font-display py-1 h-fit"
              onClick={() => setShowDeleteWorkspaceModal(true)}
              disabledTooltip={permissionError || undefined}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

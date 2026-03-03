import { Button } from "@repo/ui";
import { useDeleteWorkspaceModal } from "@/ui/modals/delete-workspace-modal";
export default function DeleteWorkspace() {
  const { setShowDeleteWorkspaceModal, DeleteWorkspaceModal } =
    useDeleteWorkspaceModal();
  return (
    <div>
      <DeleteWorkspaceModal />
      <div className="space-y-0.5">
        <h2 className="font-medium text-sm font-display text-neutral-600">Delete Workspace</h2>
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
        />
      </div>
    </div>
  );
}

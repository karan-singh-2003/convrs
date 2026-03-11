import { Modal } from "@repo/ui";
import { CreateWorkspaceForm } from "../workspaces/create-workspace-form";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
function CreateWorkspaceModal({
  showCreateWorkspaceModal,
  setShowCreateWorkspaceModal,
}: {
  showCreateWorkspaceModal: boolean;
  setShowCreateWorkspaceModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const router = useRouter();
  return (
    <Modal
      showModal={showCreateWorkspaceModal}
      setShowModal={setShowCreateWorkspaceModal}
      className="px-4 py-3 md:px-0 md:py-1.5 max-h-[90vh] md:max-h-[95dvh] md:overflow-y-auto"
    >
      <div className="space-y-1 md:py-1 md:border-b md:border-[#F0F0F0]">
        <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
          Create Workspace
        </h3>
      </div>

      <div className="md:py-4 md:px-5 gap-y-5">
        <p className="text-[13px] mb-5 md:text-[14.5px] font-display text-neutral-500">
          Workspaces help you organize projects, manage teammates, and control
          permissions in one place.
        </p>

        <CreateWorkspaceForm
          onSuccess={({ slug }) => {
            {
              router.push(`/${slug}`);
              toast.success("Successfully created workspace!");
            }
            setShowCreateWorkspaceModal(false);
          }}
        />
      </div>
    </Modal>
  );
}

export function useCreateWorkspaceModal() {
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] =
    useState(false);

  const CreateWorkspaceModalCallback = useCallback(() => {
    return (
      <CreateWorkspaceModal
        showCreateWorkspaceModal={showCreateWorkspaceModal}
        setShowCreateWorkspaceModal={setShowCreateWorkspaceModal}
      />
    );
  }, [showCreateWorkspaceModal, setShowCreateWorkspaceModal]);

  return useMemo(
    () => ({
      setShowCreateWorkspaceModal,
      CreateWorkspaceModal: CreateWorkspaceModalCallback,
    }),
    [setShowCreateWorkspaceModal, CreateWorkspaceModalCallback]
  );
}

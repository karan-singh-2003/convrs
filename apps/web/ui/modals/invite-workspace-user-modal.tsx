import { Modal } from "@repo/ui";
import { InviteTeammatesForm } from "../workspaces/invite-teammates-form";
import { useCallback, useMemo, useState } from "react";

function InviteWorkspaceUserModal({
  showInviteWorkspaceUserModal,
  setShowInviteWorkspaceUserModal,
}: {
  showInviteWorkspaceUserModal: boolean;
  setShowInviteWorkspaceUserModal: React.Dispatch<
    React.SetStateAction<boolean>
  >;
}) {
  return (
    <Modal
      showModal={showInviteWorkspaceUserModal}
      setShowModal={setShowInviteWorkspaceUserModal}
      className="px-4 py-3 md:px-0 md:py-1.5 max-h-[90vh] md:max-h-[95dvh] md:overflow-y-auto"
    >
      <div className="space-y-1 md:py-1 md:border-b md:border-[#F0F0F0]">
        <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
          Invite Teammates
        </h3>
      </div>

      <div className="md:py-4 md:px-5">
        <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500">
          Invite teammates with different roles and permissions. Invitations
          will be valid for 14 days.
        </p>

        <InviteTeammatesForm
          onSuccess={() => {
            setShowInviteWorkspaceUserModal(false);
          }}
          className="mt-4 md:mt-3"
        />
      </div>
    </Modal>
  );
}

export function useInviteWorkspaceUserModal() {
  const [showInviteWorkspaceUserModal, setShowInviteWorkspaceUserModal] =
    useState(false);
  const InviteWorkspaceUserModalCallback = useCallback(() => {
    return (
      <InviteWorkspaceUserModal
        showInviteWorkspaceUserModal={showInviteWorkspaceUserModal}
        setShowInviteWorkspaceUserModal={setShowInviteWorkspaceUserModal}
      />
    );
  }, [showInviteWorkspaceUserModal, setShowInviteWorkspaceUserModal]);

  return useMemo(
    () => ({
      setShowInviteWorkspaceUserModal,
      InviteWorkspaceUserModal: InviteWorkspaceUserModalCallback,
    }),
    [setShowInviteWorkspaceUserModal, InviteWorkspaceUserModalCallback]
  );
}

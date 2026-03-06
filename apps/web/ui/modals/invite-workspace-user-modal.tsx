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
      className="px-4 py-2 md:px-2  max-h-[95dvh] "
    >
      <div className="space-y-1.5 md:px-3 md:py-2  ">
        <h3 className="text-[16.5px] font-display font-semibold ">
          Invite Teammates
        </h3>
      </div>
      <div className="md:py-2 md:px-3">
        <p className="text-[14.5px] font-medium  font-display text-neutral-500 ">
          Invite teammates with different roles and permissions. Invitations
          will be valid for 14 days.
        </p>
        <InviteTeammatesForm
          onSuccess={() => {
            setShowInviteWorkspaceUserModal(false);
          }}
          className="mt-3"
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

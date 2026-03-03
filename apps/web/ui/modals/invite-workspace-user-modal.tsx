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
      className="max-w-md rounded-none max-h-[95dvh] "
    >
      <div className="space-y-1.5 border-b border-neutral-200 px-4 py-4 sm:px-6">
        <h3 className="text-sm font-default">Invite Teammates</h3>
        <p className="text-[13.5px] text-neutral-500 font-default">
          Invite teammates with different roles and permissions. Invitations
          will be valid for 14 days.
        </p>
      </div>
      <InviteTeammatesForm
        onSuccess={() => {
          setShowInviteWorkspaceUserModal(false);
        }}
        className="bg-neutral-50 px-4 py-4 sm:px-6"
      />
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

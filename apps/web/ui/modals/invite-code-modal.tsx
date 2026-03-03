import useWorkspace from "@/lib/swr/use-workspace";
import { Modal } from "@repo/ui";
import React, { useCallback, useMemo, useState } from "react";
import { APP_DOMAIN } from "@repo/utils";
import { Button } from "@repo/ui";
import { CopyButton } from "@repo/ui";

function InviteCodeModal({
  showInviteCodeModal,
  setShowInviteCodeModal,
}: {
  showInviteCodeModal: boolean;
  setShowInviteCodeModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { inviteCode } = useWorkspace();
  const inviteLink = useMemo(() => {
    return `${APP_DOMAIN}/invites/${inviteCode}`;
  }, [inviteCode]);
  return (
    <Modal
      showModal={showInviteCodeModal}
      setShowModal={setShowInviteCodeModal}
      className="max-w-md rounded-none max-h-[95dvh] "
    >
      <div className="space-y-1.5 border-b border-neutral-200 px-4 py-4 sm:px-6">
        <h3 className="text-sm font-default">Invite Link</h3>
        <p className="text-[13.5px] text-neutral-500 font-default">
          Allow other people to join your workspace through the link below.
        </p>
      </div>
      <div className="flex flex-col space-y-4 bg-neutral-50 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between rounded-none border border-neutral-300 bg-white px-3 py-1.5">
          <p className="scrollbar-hide w-[88%] overflow-scroll font-mono text-xs text-neutral-500">
            {inviteLink}
          </p>
          <CopyButton value={inviteLink} className="rounded-md" />
        </div>
        <Button text="Reset invite link" variant="secondary" />
      </div>
    </Modal>
  );
}

export function useInviteCodeModal() {
  const [showInviteCodeModal, setShowInviteCodeModal] = useState(false);
  const InviteCodeModalCallback = useCallback(() => {
    return (
      <InviteCodeModal
        showInviteCodeModal={showInviteCodeModal}
        setShowInviteCodeModal={setShowInviteCodeModal}
      />
    );
  }, [showInviteCodeModal, setShowInviteCodeModal]);

  return useMemo(
    () => ({
      setShowInviteCodeModal,
      InviteCodeModal: InviteCodeModalCallback,
    }),
    [setShowInviteCodeModal, InviteCodeModalCallback]
  );
}

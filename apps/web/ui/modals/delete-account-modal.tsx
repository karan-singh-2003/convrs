"use client";
import { Modal, Avatar, useMediaQuery, Button } from "@repo/ui";
import { useSession } from "next-auth/react";
import { useCallback, useMemo, useState } from "react";
import { cn } from "@repo/utils";

function DeleteAccountModal({
  showDeleteAccountModal,
  setShowDeleteAccountModal,
}: {
  showDeleteAccountModal?: boolean;
  setShowDeleteAccountModal?: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { isMobile } = useMediaQuery();
  const { data: session } = useSession();

  const confirmationText = "DELETE MY ACCOUNT";

  const [verification, setVerification] = useState("");
  return (
    <Modal>
      <div className="space-y-1.5 border-b border-neutral-200 px-4 py-4 sm:px-6">
        <h3 className="text-sm font-default">Delete Account</h3>
        <p className="text-[14px] text-neutral-500">
          Warning: This will permanently delete your account, all your
          workspaces, and all your data.
        </p>
        <form action="">
          <div className="relative flex items-center gap-3 rounded-md border border-neutral-300 bg-white px-4 py-2">
            <Avatar user={session?.user} className="size-7" />
            <div className="flex flex-1 flex-col gap-0.5">
              <h3 className="line-clamp-1 text-sm font-medium text-neutral-600">
                {session?.user?.name || session?.user?.email}
              </h3>
              <p className="text-xs font-medium text-neutral-500">
                {session?.user?.email}
              </p>
            </div>
          </div>
          <div>
            <label
              htmlFor="verification"
              className="block text-sm text-neutral-700"
            >
              To verify, type{" "}
              <span className="font-semibold">{confirmationText}</span> below
            </label>
            <div className="relative mt-1 rounded-md shadow-sm">
              <input
                type="text"
                name="verification"
                id="verification"
                pattern={confirmationText}
                required
                autoFocus={!isMobile}
                autoComplete="off"
                value={verification}
                onChange={(e) => setVerification(e.target.value)}
                className={cn(
                  "block w-full rounded-md border-neutral-300 text-neutral-900 placeholder-neutral-300 focus:border-neutral-500 focus:outline-none focus:ring-neutral-500 sm:text-sm"
                )}
              />
            </div>
          </div>

          <Button text="Delete" variant="danger" />
        </form>
      </div>
    </Modal>
  );
}

export function useDeleteAccountModal() {
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);

  const DeleteAccountModalCallback = useCallback(() => {
    return (
      <DeleteAccountModal
        showDeleteAccountModal={showDeleteAccountModal}
        setShowDeleteAccountModal={setShowDeleteAccountModal}
      />
    );
  }, [showDeleteAccountModal]);

  return useMemo(
    () => ({
      setShowDeleteAccountModal,
      DeleteAccountModal: DeleteAccountModalCallback,
    }),
    [DeleteAccountModalCallback]
  );
}

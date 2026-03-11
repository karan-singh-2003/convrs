"use client";
import { Modal, Avatar, useMediaQuery, Button } from "@repo/ui";
import { useSession } from "next-auth/react";
import { useCallback, useMemo, useState } from "react";
import { cn } from "@repo/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
  const [isDeleting, setDeleting] = useState(false);
  const router = useRouter();
  const { update } = useSession();

  async function deleteAccount() {
    return new Promise((resolve, reject) => {
      setDeleting(true);
      fetch(`/api/user`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }).then(async (res) => {
        if (res.status === 200) {
          update();
          // delay to allow for the route change to complete
          await new Promise((resolve) =>
            setTimeout(() => {
              router.push("/register");
              resolve(null);
            }, 200)
          );
          resolve(null);
        } else {
          setDeleting(false);
          const error = await res.text();
          reject(error);
        }
      });
    });
  }
  return (
    <Modal
      showModal={showDeleteAccountModal}
      setShowModal={setShowDeleteAccountModal}
      className="px-4 md:px-0 py-3 md:py-1.5 max-h-[90vh] md:max-h-[95dvh] overflow-y-auto"
    >
      {/* Header */}
      <div className="space-y-1 md:py-1 md:border-b border-[#F0F0F0]">
        <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
          Delete Account
        </h3>
      </div>

      <div className="md:px-5 md:py-4">
        {/* Warning */}
        <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500">
          Warning: This will permanently delete your account, all your
          workspaces, and all your data.
        </p>

        <form
          className="flex flex-col space-y-4 mt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            toast.promise(deleteAccount(), {
              loading: "Deleting account...",
              success: "Account deleted successfully!",
              error: (err) => err,
            });
          }}
        >
          {/* User card */}
          <div className="flex items-center gap-3 bg-neutral-100/50 px-3 py-2 md:px-4">
            <Avatar user={session?.user} className="size-8 md:size-9" />

            <div className="flex flex-1 flex-col gap-0.5">
              <h3 className="line-clamp-1 text-[13px] md:text-sm font-display font-medium text-neutral-700">
                {session?.user?.name || session?.user?.email}
              </h3>

              <p className="text-[12px] md:text-sm font-display text-neutral-500">
                {session?.user?.email}
              </p>
            </div>
          </div>

          {/* Verification */}
          <div>
            <label
              htmlFor="verification"
              className="block font-display text-[13px] md:text-[14.5px] text-neutral-600"
            >
              To verify, type{" "}
              <span className="font-medium">{confirmationText}</span> below
            </label>

            <div className="relative mt-1">
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
                className="block w-full font-display border-neutral-200 text-neutral-600 placeholder-neutral-300 focus:border-neutral-500 focus:outline-none focus:ring-0 text-[13px] md:text-[14.5px] py-2 md:py-2.5"
              />
            </div>
          </div>

          {/* Button */}
          <Button
            text="Delete Account"
            variant="danger"
            className="h-9 md:h-10 text-sm font-display"
          />
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

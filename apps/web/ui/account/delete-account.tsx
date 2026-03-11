import { Button } from "@repo/ui";
import { useDeleteAccountModal } from "../modals/delete-account-modal";
export default function DeleteAccount() {
  const { setShowDeleteAccountModal, DeleteAccountModal } =
    useDeleteAccountModal();
  return (
    <div>
      <DeleteAccountModal />
      <div className="space-y-0.5">
        <h2 className="font-medium text-sm">Delete Account</h2>
        <p className="font-default text-[13.5px] text-neutral-500">
          Permanently delete your account, and all associated data. This
          action cannot be undone - please proceed with caution.
        </p>
      </div>
      <div className="mt-3 ">
        <Button
          text="Delete Account"
          variant="danger"
          className="w-fit text-[13px] font-display py-1 h-fit"
          onClick={() => setShowDeleteAccountModal(true)}
        />
      </div>
    </div>
  );
}

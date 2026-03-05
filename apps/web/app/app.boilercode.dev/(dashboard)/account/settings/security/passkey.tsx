"use client";

import { Button } from "@repo/ui";
import { useManagePasskeyModal } from "@/ui/modals/manage-passkey-modal";

const Passkey = () => {
  const { ManagePasskeyModal, setShowManagePasskeyModal } =
    useManagePasskeyModal();

  return (
    <>
      <ManagePasskeyModal />

      <div className="">
        <div className="space-y-1">
          <h1 className="font-display text-base font-medium text-[#5C5C5C]">
            Passkey
          </h1>
          <h1 className="font-display text-sm text-[#898989]">
            Sign in with on-device biometric authentication
          </h1>
        </div>
        <Button
          onClick={() => setShowManagePasskeyModal(true)}
          className="mt-3 h-fit w-fit py-1 text-[14px] font-display text-[#868282] bg-[#f0efef]"
          text="Manage Passkey"
        />
      </div>
    </>
  );
};

export default Passkey;

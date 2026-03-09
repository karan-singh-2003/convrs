import { disableTwoFactorAuthAction } from "@/lib/actions/auth/disable-two-factor-auth";
import useUser from "@/lib/swr/use-user";
import { Button, Modal } from "@repo/ui";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

interface DisableTwoFactorAuthModalProps {
  showModal: boolean;
  setShowModal: (showModal: boolean) => void;
}

const DisableTwoFactorAuthModal = ({
  showModal,
  setShowModal,
}: DisableTwoFactorAuthModalProps) => {
  const { mutate } = useUser();

  const { executeAsync: disable2FA, isPending: isDisabling } = useAction(
    disableTwoFactorAuthAction,
    {
      onSuccess: () => {
        toast.success("Two-factor authentication disabled successfully!");
        setShowModal(false);
        mutate();
      },
      onError({ error }) {
        toast.error(error.serverError);
      },
    }
  );

  return (
    <Modal
      showModal={showModal}
      setShowModal={setShowModal}
      className="px-4 md:px-0 py-3 md:py-1.5 max-h-[90vh] md:max-h-[95dvh] overflow-y-auto"
    >
      {/* Header */}
      <div className="space-y-1 md:py-1 md:border-b border-[#F0F0F0]">
        <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
          Disable Two-factor Authentication
        </h3>
      </div>

      <div className="md:px-5 md:py-4">
        {/* Description */}
        <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500">
          Are you sure you want to disable two-factor authentication? Your
          one-time codes will no longer be valid and your recovery codes will be
          deleted.
        </p>
      </div>

      {/* Footer */}
      <div className=" px-4 md:px-5 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            disable2FA();
          }}
          className="flex flex-col sm:flex-row justify-end gap-2"
        >
          <Button
            type="button"
            variant="secondary"
            text="Cancel"
            className="h-9 md:h-10 w-full sm:w-fit font-display"
            onClick={() => setShowModal(false)}
            disabled={isDisabling}
          />

          <Button
            type="submit"
            text="Confirm disable"
            variant="danger"
            loading={isDisabling}
            className="h-9 md:h-10 w-full sm:w-fit font-display"
          />
        </form>
      </div>
    </Modal>
  );
};

export function useDisableTwoFactorAuthModal() {
  const [showDisableTwoFactorAuthModal, setShowDisableTwoFactorAuthModal] =
    useState(false);

  const DisableTwoFactorAuthModalCallback = useCallback(() => {
    return (
      <DisableTwoFactorAuthModal
        showModal={showDisableTwoFactorAuthModal}
        setShowModal={setShowDisableTwoFactorAuthModal}
      />
    );
  }, [showDisableTwoFactorAuthModal, setShowDisableTwoFactorAuthModal]);

  return useMemo(
    () => ({
      setShowDisableTwoFactorAuthModal,
      DisableTwoFactorAuthModal: DisableTwoFactorAuthModalCallback,
    }),
    [setShowDisableTwoFactorAuthModal, DisableTwoFactorAuthModalCallback]
  );
}

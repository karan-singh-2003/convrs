"use client";

import { enableTwoFactorAuthAction } from "@/lib/actions/auth/enable-two-factor";
import useUser from "@/lib/swr/use-user";
import { useDisableTwoFactorAuthModal } from "@/ui/modals/disable-two-factor-auth-modal";
import { useEnableTwoFactorAuthModal } from "@/ui/modals/enable-two-factor-auth-modal";
import { Button } from "@repo/ui";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

export const TwoFactorAuth = () => {
  const { user, loading, mutate } = useUser();
  const [secret, setSecret] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  console.log("user", user);

  const { EnableTwoFactorAuthModal, setShowEnableTwoFactorAuthModal } =
    useEnableTwoFactorAuthModal({
      secret,
      qrCodeUrl,
      onSuccess: () => {
        setSecret("");
        setQrCodeUrl("");
        mutate();
      },
    });

  const { DisableTwoFactorAuthModal, setShowDisableTwoFactorAuthModal } =
    useDisableTwoFactorAuthModal();

  const { executeAsync: enable2FA, isPending: isEnabling } = useAction(
    enableTwoFactorAuthAction,
    {
      onSuccess: async ({ data }) => {
        if (!data) {
          toast.error("Failed to enable 2FA. Please try again.");
          return;
        }

        setSecret(data.secret);
        setQrCodeUrl(data.qrCodeUrl);
        setShowEnableTwoFactorAuthModal(true);
      },
      onError({ error }) {
        toast.error(error.serverError);
      },
    }
  );

  return (
    <>
      <EnableTwoFactorAuthModal />
      <DisableTwoFactorAuthModal />
      <div className="flex flex-col gap-y-1">
        <h1 className="font-display text-base font-medium text-[#5C5C5C]">
          Two Factor Authentication
        </h1>
        <h1 className="font-display text-sm  text-[#898989]">
          Two-factor authentication (2FA) makes your account more secure by
          adding an extra verification step when you log{" "}
        </h1>
        <Button
          text={
            loading
              ? "Loading..."
              : user?.twoFactorConfirmedAt
                ? "Disable Two-factor"
                : "Enable Two-factor"
          }
          variant={user?.twoFactorConfirmedAt ? "danger" : "primary"}
          type="button"
          className=" w-fit mt-2 h-fit py-1 text-[14px] font-display text-[#868282] bg-[#f0efef]"
          loading={isEnabling}
          disabled={loading}
          onClick={async () => {
            if (user?.twoFactorConfirmedAt) {
              setShowDisableTwoFactorAuthModal(true);
            } else {
              await enable2FA();
            }
          }}
        />
      </div>
    </>
  );
};

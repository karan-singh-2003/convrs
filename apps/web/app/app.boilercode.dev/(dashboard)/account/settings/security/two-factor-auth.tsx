"use client";

import { enableTwoFactorAuthAction } from "@/lib/actions/auth/enable-two-factor";
import useUser from "@/lib/swr/use-user";
import { useDisableTwoFactorAuthModal } from "@/ui/modals/disable-two-factor-auth-modal";
import { useEnableTwoFactorAuthModal } from "@/ui/modals/enable-two-factor-auth-modal";
import { Button, Tooltip, TooltipProvider } from "@repo/ui";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

function formatProviderName(provider: string | null | undefined): string {
  if (!provider) return "your OAuth provider";
  switch (provider.toLowerCase()) {
    case "github":
      return "GitHub";
    case "google":
      return "Google";
    case "facebook":
      return "Facebook";
    case "twitter":
      return "Twitter";
    default:
      return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}

export const TwoFactorAuth = () => {
  const { user, loading, mutate } = useUser();
  const [secret, setSecret] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");



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

  const needsPassword =
    !loading && !user?.hasPassword && !user?.twoFactorConfirmedAt;
  const providerName = formatProviderName(user?.provider);

  return (
    <TooltipProvider>
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
        {needsPassword ? (
          <Tooltip
            content={`Your account is managed by ${providerName}. Set up a password first to enable 2FA.`}
          >
            <span className="w-fit mt-2">
              <Button
                text="Enable Two-factor"
                variant="primary"
                type="button"
                className="pointer-events-none w-fit h-fit py-1 text-[14px] font-display text-[#868282] bg-[#f0efef] opacity-50"
                disabled
              />
            </span>
          </Tooltip>
        ) : (
          <Button
            text={
              loading ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm font-display text-neutral-500">
                    {" "}
                    Enable Two Factor
                  </span>
                </div>
              ) : user?.twoFactorConfirmedAt ? (
                "Disable Two-factor"
              ) : (
                "Enable Two-factor"
              )
            }
            variant={user?.twoFactorConfirmedAt ? "danger" : "primary"}
            type="button"
            className="w-fit text-[13px] font-display py-1 h-fit mt-1.5"
            loading={isEnabling}
            disabled={loading}
            disabledTooltip={
              user?.twoFactorConfirmedAt
                ? undefined
                : needsPassword
                  ? `Your account is managed by ${providerName}. Set up a password first to enable 2FA.`
                  : undefined
            }
            onClick={async () => {
              if (user?.twoFactorConfirmedAt) {
                setShowDisableTwoFactorAuthModal(true);
              } else {
                await enable2FA();
              }
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
};

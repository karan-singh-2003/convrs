import { confirmTwoFactorAuthAction } from "@/lib/actions/auth/confirm-two-factor-auth";
import { QRCode } from "@/ui/shared/qr-code";
import { Button, CopyButton, Modal } from "@repo/ui";
import { cn } from "@repo/utils";
import { OTPInput } from "input-otp";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface EnableTwoFactorAuthModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onSuccess?: () => void;
  secret: string;
  qrCodeUrl: string;
}

const EnableTwoFactorAuthModal = ({
  showModal,
  setShowModal,
  onSuccess,
  secret,
  qrCodeUrl,
}: EnableTwoFactorAuthModalProps) => {
  const [token, setToken] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (showModal) {
      setToken("");
      setTouched(false);
      setError(undefined);
    }
  }, [showModal]);

  const { executeAsync, isPending } = useAction(confirmTwoFactorAuthAction, {
    onSuccess: () => {
      toast.success("Two-factor authentication enabled successfully!");
      setShowModal(false);
      onSuccess?.();
    },
    onError: (error) => {
      setError("Failed to enable two-factor authentication. Please try again.");
    },
  });

  const confirmTwoFactorAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(undefined);

    await executeAsync({
      token,
    });
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col items-center  ">
        <h2 className="text-base font-semibold w-full px-4  py-2 font-display ">
          Enable Authenticator App
        </h2>
        <div className="p-4">
          <p className="   font-display text-sm text-neutral-600">
            Scan the QR code below with your preferred authenticator app. Then,
            enter the 6 digit code that the app provides to continue. You can
            also copy the secret below and paste it into your app.
          </p>

          <div className="mx-auto bg-neutral-100 my-4 flex items-center justify-center py-1">
            <QRCode url={qrCodeUrl} scale={2} />
          </div>

          <div className="flex items-center w-full gap-2 rounded-none border border-neutral-200 bg-neutral-100 px-3 py-2">
            <span className="select-all font-mono text-sm">{secret}</span>
            <CopyButton value={secret} />
          </div>

          <form
            onSubmit={confirmTwoFactorAuth}
            className="flex w-full flex-col my-3 items-center gap-4"
          >
            <OTPInput
              maxLength={6}
              value={token}
              onChange={setToken}
              autoFocus
              render={({ slots }) => (
                <div className="flex w-full items-center justify-between gap-1  ">
                  {slots.map(({ char, isActive, hasFakeCaret }, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "relative flex h-16 w-16 items-center justify-center font-display text-[24px]",
                        "rounded-none border-b-[3px] border-[#E0E0E0] bg-neutral-100 ring-0 transition-all",
                        isActive && "border-[#9E9E9E]",
                        ((touched && token.length < 6) || error) &&
                          "border-[#c51d1d]"
                      )}
                    >
                      {char}

                      {hasFakeCaret && (
                        <div className="animate-caret-blink pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="h-5 w-px bg-black" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            />

            {error && (
              <p className="pt-2 text-center text-sm font-medium text-red-500">
                {error}
              </p>
            )}

            <Button
              className="mt-2 w-full"
              text={isPending ? "Verifying..." : "Confirm"}
              type="submit"
              loading={isPending}
              disabled={token.length < 6}
            />
          </form>
        </div>
      </div>
    </Modal>
  );
};

export function useEnableTwoFactorAuthModal({
  onSuccess,
  secret,
  qrCodeUrl,
}: {
  onSuccess?: () => void;
  secret: string;
  qrCodeUrl: string;
}) {
  const [showModal, setShowModal] = useState(false);

  const ModalCallback = useCallback(
    () => (
      <EnableTwoFactorAuthModal
        showModal={showModal}
        setShowModal={setShowModal}
        onSuccess={onSuccess}
        secret={secret}
        qrCodeUrl={qrCodeUrl}
      />
    ),
    [showModal, onSuccess, secret, qrCodeUrl]
  );

  return useMemo(
    () => ({
      setShowEnableTwoFactorAuthModal: setShowModal,
      EnableTwoFactorAuthModal: ModalCallback,
    }),
    [setShowModal, ModalCallback]
  );
}

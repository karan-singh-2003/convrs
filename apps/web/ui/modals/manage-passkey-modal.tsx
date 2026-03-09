import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Modal, Button, Google } from "@repo/ui";
import { toast } from "sonner";
import { usePasskeys } from "@/lib/swr/use-passkeys";
import { Key, Trash2 } from "lucide-react";
import { create } from "@github/webauthn-json";

function getRelativeTime(dateString: string) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ManagePasskeyModal({
  showManagePasskeyModal,
  setShowManagePasskeyModal,
}: {
  showManagePasskeyModal: boolean;
  setShowManagePasskeyModal: Dispatch<SetStateAction<boolean>>;
}) {
  const { passkeys, loading: isLoadingPasskeys, mutate } = usePasskeys();
  const [isRegistering, setIsRegistering] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function registerPasskey() {
    setIsRegistering(true);
    try {
      const startResponse = await fetch("/api/account/passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        throw new Error(
          errorData.details || "Failed to start passkey registration"
        );
      }

      const options = await startResponse.json();
      const credential = await create(options as any);

      const finishResponse = await fetch("/api/account/passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      if (!finishResponse.ok) {
        const errorData = await finishResponse.json();
        throw new Error(
          errorData.details || "Failed to complete passkey registration"
        );
      }

      toast.success("Passkey registered successfully!");
      mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to register passkey"
      );
    } finally {
      setIsRegistering(false);
    }
  }

  async function removePasskey(credentialId: string) {
    setRemovingId(credentialId);
    try {
      const response = await fetch("/api/account/passkey", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove passkey");
      }

      toast.success("Passkey removed successfully!");
      mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove passkey"
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Modal
      showModal={showManagePasskeyModal}
      setShowModal={setShowManagePasskeyModal}
      className="px-4 md:px-0 py-3 md:py-1.5 max-h-[90vh] md:max-h-[95dvh] overflow-y-auto"
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="space-y-1 md:py-1 md:border-b border-[#F0F0F0]">
          <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
            Manage Passkey
          </h3>
        </div>

        {/* Body */}
        <div className="md:px-5 md:py-4">
          <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500">
            Use your device&apos;s built-in security features like Face ID to
            sign in instead of remembering passwords.
          </p>

          {/* Active Passkeys */}
          <div className="mt-5">
            <h4 className="text-[13px] md:text-sm font-display font-medium text-neutral-700">
              Active Passkeys
            </h4>

            <div className="mt-3 space-y-3">
              {isLoadingPasskeys ? (
                <div className="flex items-center justify-center border border-neutral-200 bg-neutral-50 py-6">
                  <p className="text-[13px] md:text-sm font-display text-neutral-500">
                    Loading
                  </p>
                </div>
              ) : passkeys.length === 0 ? (
                <div className="flex items-center justify-center border border-neutral-200 bg-neutral-50 py-6">
                  <p className="text-[13px] md:text-sm font-display text-neutral-500">
                    No passkeys registered yet.
                  </p>
                </div>
              ) : (
                passkeys.map((passkey) => (
                  <div
                    key={passkey.id}
                    className="flex items-center justify-between rounded-full bg-neutral-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full bg-white border border-neutral-200 shadow-sm">
                        <Google className="h-6 w-6 md:h-7 md:w-7" />
                      </div>

                      <div>
                        <p className="text-[13px] md:text-sm font-display font-medium text-neutral-900">
                          {passkey.name || "Passkey"}
                        </p>

                        <p className="text-[12px] md:text-sm font-display text-neutral-500">
                          Setup {getRelativeTime(passkey.created_at)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500 disabled:opacity-50"
                      onClick={() => removePasskey(passkey.id)}
                      disabled={removingId === passkey.id}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="size-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 md:px-5 pb-4">
          <Button
            text="Add Passkey"
            className="h-9 md:h-10 w-full font-display text-sm text-white bg-neutral-700 hover:bg-neutral-700"
            onClick={registerPasskey}
            loading={isRegistering}
            disabled={isRegistering}
          />
        </div>
      </div>
    </Modal>
  );
}

export function useManagePasskeyModal() {
  const [showManagePasskeyModal, setShowManagePasskeyModal] = useState(false);

  const ManagePasskeyModalCallback = useCallback(() => {
    return (
      <ManagePasskeyModal
        showManagePasskeyModal={showManagePasskeyModal}
        setShowManagePasskeyModal={setShowManagePasskeyModal}
      />
    );
  }, [showManagePasskeyModal, setShowManagePasskeyModal]);

  return useMemo(
    () => ({
      setShowManagePasskeyModal,
      ManagePasskeyModal: ManagePasskeyModalCallback,
    }),
    [setShowManagePasskeyModal, ManagePasskeyModalCallback]
  );
}

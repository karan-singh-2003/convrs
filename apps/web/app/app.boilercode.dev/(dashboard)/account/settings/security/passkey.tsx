"use client";

import { Button, Modal } from "@repo/ui";
import { useState } from "react";
import { usePasskeys } from "@/lib/swr/use-passkeys";
import { create } from "@github/webauthn-json";
import { toast } from "sonner";
import { Key, Trash2 } from "lucide-react";

const Passkey = () => {
  const [showRemovePasskeyModal, setShowRemovePasskeyModal] = useState(false);
  const [selectedPasskeyId, setSelectedPasskeyId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const { passkeys, loading: isLoadingPasskeys, mutate } = usePasskeys();

  const closeRemoveModal = () => {
    setShowRemovePasskeyModal(false);
    setSelectedPasskeyId(null);
  };

  const confirmRemove = async () => {
    if (!selectedPasskeyId) {
      return;
    }

    await removePasskey(selectedPasskeyId);
    closeRemoveModal();
  };

  async function registerPasskey() {
    setIsLoading(true);
    try {
      // Step 1: Get registration options from server
      console.log("Starting passkey registration...");
      const startResponse = await fetch("/api/account/passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        console.error("Start registration failed:", errorData);
        throw new Error(
          errorData.details || "Failed to start passkey registration"
        );
      }

      const options = await startResponse.json();
      console.log("Registration options received");

      // Step 2: Create the passkey using browser WebAuthn API
      console.log("Creating passkey credential...");
      const credential = await create(options as any);
      console.log("Credential created successfully");

      // Step 3: Send the credential back to server to finish registration
      const finishResponse = await fetch("/api/account/passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      if (!finishResponse.ok) {
        const errorData = await finishResponse.json();
        console.error("Finish registration failed:", errorData);
        throw new Error(
          errorData.details || "Failed to complete passkey registration"
        );
      }

      console.log("Passkey registration completed successfully");
      toast.success("Passkey registered successfully!");
      mutate(); // Refresh the passkeys list
    } catch (error) {
      console.error("Passkey registration error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to register passkey"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function removePasskey(credentialId: string) {
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
      mutate(); // Refresh the passkeys list
    } catch (error) {
      console.error("Passkey removal error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove passkey"
      );
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <>
      <Modal
        showModal={showRemovePasskeyModal}
        setShowModal={setShowRemovePasskeyModal}
        onClose={() => setSelectedPasskeyId(null)}
      >
        <div className="space-y-2 px-4 py-4 sm:px-6">
          <h3 className="text-lg font-medium">Remove passkey</h3>
          <p className="text-sm text-neutral-500">
            Are you sure you want to remove this passkey? This action cannot be
            undone. You will need to register a new passkey to continue using
            passwordless authentication.
          </p>
        </div>

        <div className="bg-neutral-50">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              confirmRemove();
            }}
          >
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-4 sm:px-6">
              <Button
                type="button"
                variant="secondary"
                text="Cancel"
                className="h-9 w-fit"
                onClick={closeRemoveModal}
              />
              <Button
                type="submit"
                text="Remove passkey"
                variant="danger"
                className="h-9 w-fit"
                disabled={!selectedPasskeyId}
              />
            </div>
          </form>
        </div>
      </Modal>

      <div className="space-y-6">
        {/* Register Passkey Section */}
        <div className="rounded-none border border-neutral-200 p-10">
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-xl font-medium">Register a passkey</h2>
              <p className="text-sm font-default text-neutral-500">
                Never use a password or oauth again. Register a passkey to make
                logging in easy.
              </p>
            </div>
            <Button
              onClick={() => registerPasskey()}
              className="flex w-fit items-center font-default  text-white justify-center space-x-2"
              disabled={isLoading}
              loading={isLoading}
              text="Register a new passkey"
            />
          </div>
        </div>

        {/* Existing Passkeys Section */}
        <div className="rounded-none border border-neutral-200 p-10">
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-xl font-medium">Your passkeys</h2>
              <p className="text-[14.5px] font-default text-neutral-500">
                Manage your registered passkeys. You can remove passkeys you no
                longer use.
              </p>
            </div>

            {isLoadingPasskeys ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm font-default text-neutral-500">
                  Loading passkeys...
                </div>
              </div>
            ) : passkeys.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm font-default text-neutral-500">
                  No passkeys registered yet.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {passkeys.map((passkey) => (
                  <div
                    key={passkey.id}
                    className="flex items-center justify-between rounded-none border border-neutral-200 p-4"
                  >
                    <div className="flex items-center space-x-4">
                      <Key className="h-5 w-5 text-neutral-500" />
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {passkey.name || "Unnamed Passkey"}
                        </div>
                        <div className="text-xs font-default text-neutral-500">
                          Created: {formatDate(passkey.created_at)}
                          {passkey.last_used_at && (
                            <span className="ml-4">
                              Last used: {formatDate(passkey.last_used_at)}
                            </span>
                          )}
                        </div>
                        {passkey.transports &&
                          passkey.transports.length > 0 && (
                            <div className="text-xs text-neutral-500">
                              Transports: {passkey.transports.join(", ")}
                            </div>
                          )}
                      </div>
                    </div>
                    <Button
                      variant="danger-outline"
                      className="bg-red-500 w-fit font-default text-white hover:bg-red-600"
                      onClick={() => {
                        setSelectedPasskeyId(passkey.id);
                        setShowRemovePasskeyModal(true);
                      }}
                      text="Delete"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Passkey;

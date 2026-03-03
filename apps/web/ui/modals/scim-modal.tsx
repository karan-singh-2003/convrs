import useSCIM from "@/lib/swr/use-scim";
import useWorkspace from "@/lib/swr/use-workspace";
import { SAMLProviderProps } from "@/lib/types";
import { Button, Copy, Modal, Tick, useCopyToClipboard } from "@repo/ui";
import { SAML_PROVIDERS } from "@repo/utils";
import { Eye, EyeOff } from "lucide-react";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

function SCIMModal({
  showSCIMModal,
  setShowSCIMModal,
}: {
  showSCIMModal: boolean;
  setShowSCIMModal: Dispatch<SetStateAction<boolean>>;
}) {
  const { id } = useWorkspace();
  const [submitting, setSubmitting] = useState(false);
  const { scim, provider, configured, mutate } = useSCIM();
  const [selectedProvider, setSelectedProvider] = useState<
    SAMLProviderProps["scim"] | undefined
  >(provider || undefined);
  const [showBearerToken, setShowBearerToken] = useState(false);
  const [copiedBaseUrl, copyBaseUrlToClipboard] = useCopyToClipboard();
  const [copiedBearerToken, copyBearerTokenToClipboard] = useCopyToClipboard();

  const currentProvider = useMemo(
    () => SAML_PROVIDERS.find((p) => p.scim === selectedProvider),
    [selectedProvider]
  );

  useEffect(() => {
    if (provider && provider !== selectedProvider) {
      setSelectedProvider(provider as SAMLProviderProps["scim"]);
    }
  }, [provider]);

  return (
    <Modal showModal={showSCIMModal} setShowModal={setShowSCIMModal}>
      <div className="border-b border-neutral-200 px-6 py-4">
        <h3 className="text-lg font-medium text-neutral-900">
          Directory Sync Configuration
        </h3>
        <p className="mt-1 text-sm font-default text-neutral-500">
          {configured
            ? "Update your SCIM directory configuration"
            : "Configure SCIM to sync users from your identity provider"}
        </p>
      </div>

      <div className="px-6 py-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            fetch(`/api/workspaces/${id}/scim`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                provider: e.currentTarget.provider.value,
                ...(configured && {
                  currentDirectoryId: scim.directories[0].id,
                }),
              }),
            }).then(async (res) => {
              if (res.ok) {
                await mutate();
                toast.success("Successfully configured SCIM");
              } else {
                const { error } = await res.json();
                toast.error(error.message);
              }
              setSubmitting(false);
            });
          }}
          className="flex flex-col space-y-4"
        >
          <div>
            <label
              htmlFor="provider"
              className="block text-sm font-medium text-neutral-900"
            >
              Directory Provider
            </label>
            <select
              id="provider"
              name="provider"
              required
              value={selectedProvider || ""}
              onChange={(e) =>
                setSelectedProvider(e.target.value as SAMLProviderProps["scim"])
              }
              className="mt-1 block w-full appearance-none rounded-none border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            >
              <option value="" disabled>
                Select a provider
              </option>
              {SAML_PROVIDERS.map((provider) => (
                <option
                  key={provider.scim}
                  value={provider.scim}
                  disabled={provider.wip}
                >
                  {provider.name} {provider.wip && "(Coming Soon)"}
                </option>
              ))}
            </select>
          </div>

          {configured &&
            currentProvider &&
            selectedProvider === provider &&
            scim?.directories?.[0] && (
              <>
                <div className="border-t border-neutral-200" />

                <div>
                  <label className="block text-sm font-medium text-neutral-900">
                    SCIM Base URL
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={scim.directories[0].scim.endpoint}
                      className="block w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-600"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = scim.directories[0].scim.endpoint as string;
                        toast.promise(copyBaseUrlToClipboard(url), {
                          success: "Copied to clipboard",
                        });
                      }}
                      className="rounded-none border border-neutral-300 bg-white p-2 hover:bg-neutral-50"
                    >
                      {copiedBaseUrl ? (
                        <Tick className="h-4 w-4 text-neutral-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-neutral-500" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-900">
                    Bearer Token
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type={showBearerToken ? "text" : "password"}
                      readOnly
                      value={scim.directories[0].scim.secret}
                      className="block w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-600"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const token = scim.directories[0].scim.secret as string;
                        toast.promise(copyBearerTokenToClipboard(token), {
                          success: "Copied to clipboard",
                        });
                      }}
                      className="rounded-none border border-neutral-300 bg-white p-2 hover:bg-neutral-50"
                    >
                      {copiedBearerToken ? (
                        <Tick className="h-4 w-4 text-neutral-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-neutral-500" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBearerToken(!showBearerToken)}
                      className="rounded-none border border-neutral-300 bg-white p-2 hover:bg-neutral-50"
                    >
                      {showBearerToken ? (
                        <Eye className="h-4 w-4 text-neutral-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-neutral-500" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

          <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
            {configured && selectedProvider === provider ? (
              <Button
                text="Close"
                variant="secondary"
                onClick={() => setShowSCIMModal(false)}
              />
            ) : (
              <>
                <Button
                  text="Cancel"
                  variant="secondary"
                  onClick={() => setShowSCIMModal(false)}
                />
                <Button
                  text="Save"
                  type="submit"
                  loading={submitting}
                  disabled={!currentProvider}
                />
              </>
            )}
          </div>
        </form>
      </div>
    </Modal>
  );
}

export function useSCIMModal() {
  const [showSCIMModal, setShowSCIMModal] = useState(false);

  const SCIMModalCallback = useCallback(() => {
    return (
      <SCIMModal
        showSCIMModal={showSCIMModal}
        setShowSCIMModal={setShowSCIMModal}
      />
    );
  }, [showSCIMModal, setShowSCIMModal]);

  return useMemo(
    () => ({
      setShowSCIMModal,
      SCIMModal: SCIMModalCallback,
    }),
    [setShowSCIMModal, SCIMModalCallback]
  );
}

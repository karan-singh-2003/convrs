import useSCIM from "@/lib/swr/use-scim";
import useWorkspace from "@/lib/swr/use-workspace";
import { SAMLProviderProps } from "@/lib/types";
import {
  Button,
  Copy,
  Modal,
  OptionSelect,
  Tick,
  useCopyToClipboard,
} from "@repo/ui";
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
      <div className="flex flex-col space-y-3  px-4 md:py-3">
        <h3 className="text-base font-medium text-neutral-700">Manage SCIM</h3>
      </div>

      <div className="px-4 py-2">
        <p className="text-sm font-medium text-neutral-500 font-default">
          {configured
            ? "Update your SCIM directory configuration."
            : `Configure SCIM to sync users from your identity provider into your ${process.env.NEXT_PUBLIC_APP_NAME} workspace.`}
        </p>
        <div className="flex flex-col space-y-6 py-3 text-left">
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
                  provider: selectedProvider,
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
              <div className="flex items-center my-2 space-x-1">
                <h2 className="text-sm font-medium font-display text-neutral-700">
                  Directory Provider
                </h2>
              </div>
              <OptionSelect
                options={SAML_PROVIDERS.map((p) => ({
                  value: p.scim,
                  label: p.name,
                  logo: p.logo,
                  disabled: p.wip,
                }))}
                value={selectedProvider}
                onValueChange={(v) =>
                  setSelectedProvider(v as SAMLProviderProps["scim"])
                }
                placeholder="Select a provider"
              />
            </div>

            {configured &&
              currentProvider &&
              selectedProvider === provider &&
              scim?.directories?.[0] && (
                <>
        

                  <div>
                    <label className="block text-sm font-medium font-display text-neutral-700">
                      SCIM Base URL
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={scim.directories[0].scim.endpoint}
                        className="block w-full rounded-none border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = scim.directories[0].scim
                            .endpoint as string;
                          toast.promise(copyBaseUrlToClipboard(url), {
                            success: "Copied to clipboard",
                          });
                        }}
                        className="rounded-none border border-neutral-200 bg-white p-2 hover:bg-neutral-50"
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
                    <label className="block text-sm font-medium font-display text-neutral-700">
                      Bearer Token
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type={showBearerToken ? "text" : "password"}
                        readOnly
                        value={scim.directories[0].scim.secret}
                        className="block w-full rounded-none border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const token = scim.directories[0].scim
                            .secret as string;
                          toast.promise(copyBearerTokenToClipboard(token), {
                            success: "Copied to clipboard",
                          });
                        }}
                        className="rounded-none border border-neutral-200 bg-white p-2 hover:bg-neutral-50"
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
                        className="rounded-none border border-neutral-200 bg-white p-2 hover:bg-neutral-50"
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

            <div className="">
              {configured && selectedProvider === provider ? (
                <Button
                  text="Close"
                  variant="secondary"
                  className="w-full font-display"
                  onClick={() => setShowSCIMModal(false)}
                />
              ) : (
                <div className="flex gap-2">
                  <Button
                    text="Save changes"
                    type="submit"
                    className="flex-1 font-display text-white"
                    loading={submitting}
                    disabled={!currentProvider}
                  />
                </div>
              )}
            </div>
          </form>
        </div>
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

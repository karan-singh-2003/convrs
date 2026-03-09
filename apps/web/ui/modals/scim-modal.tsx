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
    <Modal
      showModal={showSCIMModal}
      setShowModal={setShowSCIMModal}
      className="px-4 md:px-0 py-3 md:py-1.5 max-h-[90vh] md:max-h-[95dvh] md:overflow-y-auto"
    >
      {/* Header */}
      <div className="space-y-1 md:py-1 md:border-b border-[#F0F0F0]">
        <h3 className="text-[15px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
          Manage SCIM
        </h3>
      </div>

      <div className="md:px-5 md:py-2">
        {/* Description */}
        <p className="mt-1 text-[14px] md:text-[14.5px] leading-relaxed font-display text-neutral-500">
          {configured
            ? "Update your SCIM directory configuration."
            : `Configure SCIM to automatically sync users from your identity provider into your ${process.env.NEXT_PUBLIC_APP_NAME} workspace.`}
        </p>

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
          className="md:mt-3 mt-5 flex flex-col space-y-5"
        >
          {/* Provider */}
          <div>
            <label className="block text-[13px] md:text-sm font-display font-medium text-neutral-600 mb-2">
              Directory Provider
            </label>

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

          {/* Existing configuration */}
          {configured &&
            currentProvider &&
            selectedProvider === provider &&
            scim?.directories?.[0] && (
              <div className="flex flex-col space-y-5">
                {/* SCIM Base URL */}
                <div>
                  <label className="block text-[13px] md:text-sm font-display font-medium text-neutral-600 mb-1.5">
                    SCIM Base URL
                  </label>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={scim.directories[0].scim.endpoint}
                      className="flex-1 font-display border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] md:text-sm text-neutral-600"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const url = scim.directories[0].scim.endpoint as string;
                        toast.promise(copyBaseUrlToClipboard(url), {
                          success: "Copied to clipboard",
                        });
                      }}
                      className="border border-neutral-200 bg-white p-2 hover:bg-neutral-50"
                    >
                      {copiedBaseUrl ? (
                        <Tick className="h-4 w-4 text-neutral-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-neutral-500" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bearer Token */}
                <div>
                  <label className="block text-[13px] md:text-sm font-display font-medium text-neutral-600 mb-1.5">
                    Bearer Token
                  </label>

                  <div className="flex items-center gap-2">
                    <input
                      type={showBearerToken ? "text" : "password"}
                      readOnly
                      value={scim.directories[0].scim.secret}
                      className="flex-1 font-display border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] md:text-sm text-neutral-600"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const token = scim.directories[0].scim.secret as string;
                        toast.promise(copyBearerTokenToClipboard(token), {
                          success: "Copied to clipboard",
                        });
                      }}
                      className="border border-neutral-200 bg-white p-2 hover:bg-neutral-50"
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
                      className="border border-neutral-200 bg-white p-2 hover:bg-neutral-50"
                    >
                      {showBearerToken ? (
                        <Eye className="h-4 w-4 text-neutral-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-neutral-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

          {/* Action */}
          <div className="">
            {configured && selectedProvider === provider ? (
              <Button
                text="Close"
                variant="secondary"
                className="w-full font-display text-neutral-600 h-9 md:h-10"
                onClick={() => setShowSCIMModal(false)}
              />
            ) : (
              <Button
                text="Save changes"
                type="submit"
                className="w-full font-display text-neutral-600 text-white h-9 md:h-10"
                loading={submitting}
                disabled={!currentProvider}
              />
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

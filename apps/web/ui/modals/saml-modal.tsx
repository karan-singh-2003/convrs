import useSAML from "@/lib/swr/use-saml";
import useWorkspace from "@/lib/swr/use-workspace";
import { SAMLProviderProps } from "@/lib/types";
import { Button, Modal, OptionSelect, useMediaQuery } from "@repo/ui";
import { SAML_PROVIDERS } from "@repo/utils";
import { Check, Lock, UploadCloud } from "lucide-react";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

function SAMLModal({
  showSAMLModal,
  setShowSAMLModal,
}: {
  showSAMLModal: boolean;
  setShowSAMLModal: Dispatch<SetStateAction<boolean>>;
}) {
  const { id } = useWorkspace();
  const [selectedProvider, setSelectedProvider] = useState<
    SAMLProviderProps["saml"] | undefined
  >();
  const [submitting, setSubmitting] = useState(false);
  const { mutate } = useSAML();

  const currentProvider = useMemo(
    () => SAML_PROVIDERS.find((p) => p.saml === selectedProvider),
    [selectedProvider]
  );

  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState("");

  const { isMobile } = useMediaQuery();

  return (
    <Modal
      showModal={showSAMLModal}
      setShowModal={setShowSAMLModal}
      className="px-4 md:px-0 py-3 md:py-1.5 max-h-[90vh] md:max-h-[95dvh] md:overflow-y-auto"
    >
      {/* Header */}
      <div className="space-y-1 md:py-1 md:border-b border-[#F0F0F0]">
        <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
          Manage SAML Configuration
        </h3>
      </div>

      <div className="md:py-4 md:px-5">
        {/* Description */}
        <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500">
          Configure SAML authentication for your workspace. Upload your provider
          metadata or provide the metadata URL to enable SAML login.
        </p>

        <div className="flex flex-col space-y-6 py-3 text-left">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);

              fetch(`/api/workspaces/${id}/saml`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  metadataUrl: e.currentTarget.metadataUrl?.value,
                  encodedRawMetadata: fileContent
                    ? Buffer.from(fileContent).toString("base64")
                    : undefined,
                }),
              }).then(async (res) => {
                if (res.ok) {
                  await mutate();
                  setShowSAMLModal(false);
                  toast.success("Successfully configured SAML");
                } else {
                  const { error } = await res.json();
                  toast.error(error.message);
                }
                setSubmitting(false);
              });
            }}
            className="flex flex-col space-y-5"
          >
            {/* Provider Select */}
            <div>
              <div className="flex items-center my-2 space-x-1">
                <h2 className="text-[13px] md:text-sm font-medium font-display text-neutral-700">
                  SAML Provider
                </h2>
              </div>

              <OptionSelect
                options={SAML_PROVIDERS.map((provider) => ({
                  value: provider.saml,
                  label: provider.name,
                  logo: provider.logo,
                  disabled: provider.wip,
                }))}
                value={selectedProvider}
                onValueChange={(v) =>
                  setSelectedProvider(v as SAMLProviderProps["saml"])
                }
                placeholder="Select a provider"
              />
            </div>

            {/* Google Upload */}
            {currentProvider &&
              (selectedProvider === "google" ? (
                <div>
                  <div className="flex items-center space-x-1">
                    <h2 className="text-[13px] md:text-sm font-medium font-display text-neutral-700">
                      {currentProvider.samlModalCopy}
                    </h2>
                  </div>

                  <label
                    htmlFor="metadataRaw"
                    className="group relative mt-2 flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-none border border-neutral-300 bg-white shadow-sm transition-all hover:bg-neutral-50"
                  >
                    {file ? (
                      <>
                        <Check className="h-5 w-5 text-green-600 transition-all group-hover:scale-110" />
                        <p className="mt-2 text-[13px] font-display text-neutral-500">
                          {file.name}
                        </p>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-5 w-5 text-neutral-500 transition-all group-hover:scale-110" />
                        <p className="mt-2 text-[13px] font-display text-neutral-500">
                          Choose an .xml file to upload
                        </p>
                      </>
                    )}
                  </label>

                  <input
                    id="metadataRaw"
                    name="metadataRaw"
                    type="file"
                    accept="text/xml"
                    className="sr-only"
                    required
                    onChange={(e) => {
                      const f = e.target?.files && e.target?.files[0];
                      setFile(f);

                      if (f) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          const content = e.target?.result;
                          setFileContent(content as string);
                        };
                        reader.readAsText(f);
                      }
                    }}
                  />
                </div>
              ) : (
                /* Metadata URL */
                <div className=" ">
                  <div className="flex items-center space-x-1">
                    <h2 className="text-[13px] md:text-sm font-medium font-display text-neutral-700">
                      {currentProvider.samlModalCopy}
                    </h2>
                  </div>

                  <input
                    id="metadataUrl"
                    name="metadataUrl"
                    autoFocus={!isMobile}
                    type="url"
                    placeholder="https://"
                    autoComplete="off"
                    required
                    className="mt-2 block w-full font-display border-neutral-300 px-3 py-2 text-[13px] md:text-sm placeholder-neutral-400 shadow-sm focus:border-black focus:outline-none focus:ring-0"
                  />
                </div>
              ))}

            {/* Submit */}
            <Button
              text="Save changes"
              className="text-white font-display h-9 md:h-10 text-sm"
              disabled={!selectedProvider}
              loading={submitting}
            />
          </form>
        </div>
      </div>
    </Modal>
  );
}

export function useSAMLModal() {
  const [showSAMLModal, setShowSAMLModal] = useState(false);

  const SAMLModalCallback = useCallback(() => {
    return (
      <SAMLModal
        showSAMLModal={showSAMLModal}
        setShowSAMLModal={setShowSAMLModal}
      />
    );
  }, [showSAMLModal, setShowSAMLModal]);

  return useMemo(
    () => ({
      setShowSAMLModal,
      SAMLModal: SAMLModalCallback,
    }),
    [setShowSAMLModal, SAMLModalCallback]
  );
}

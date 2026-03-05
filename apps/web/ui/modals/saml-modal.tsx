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
    <Modal showModal={showSAMLModal} setShowModal={setShowSAMLModal}>
      <div className="flex flex-col space-y-3 border-b border-neutral-200 px-4 py-2 ">
        <h3 className="text-base font-medium text-neutral-700">Manage SAML</h3>
      </div>

      <div className="px-4 py-2">
        <p className="text-sm font-medium text-neutral-500 font-display">
          Select a provider to configure SAML for your{" "}
          {process.env.NEXT_PUBLIC_APP_NAME} workspace.
        </p>
        <div className="flex flex-col space-y-6  py-3 text-left ">
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
            className="flex flex-col space-y-4"
          >
            <div>
              <div className="flex items-center my-2 space-x-1">
                <h2 className="text-sm font-medium font-display text-neutral-700">
                  SAML Provider
                </h2>
                {/* <InfoTooltip content="Your SAML provider is the service you use to manage your users." /> */}
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

            {currentProvider &&
              (selectedProvider === "google" ? (
                <div className=" ">
                  <div className="flex items-center space-x-1">
                    <h2 className="text-sm font-medium text-neutral-900">
                      {currentProvider.samlModalCopy}
                    </h2>
                    {/* <InfoTooltip
                    content={`Your ${currentProvider.samlModalCopy} is the URL to your SAML provider's metadata. [Learn more.](https://dub.co/help/article/${selectedProvider}-saml)`}
                  /> */}
                  </div>
                  <label
                    htmlFor="metadataRaw"
                    className="group relative mt-1 flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-none border border-neutral-300 bg-white shadow-sm transition-all hover:bg-neutral-50"
                  >
                    {file ? (
                      <>
                        <Check className="h-5 w-5 text-green-600 transition-all duration-75 group-hover:scale-110 group-active:scale-95" />
                        <p className="mt-2 text-sm text-neutral-500">
                          {file.name}
                        </p>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-5 w-5 text-neutral-500 transition-all duration-75 group-hover:scale-110 group-active:scale-95" />
                        <p className="mt-2 text-sm text-neutral-500">
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
                <div className="border-t border-neutral-200 pt-4">
                  <div className="flex items-center space-x-1">
                    <h2 className="text-sm font-medium text-neutral-900">
                      {currentProvider.samlModalCopy}
                    </h2>
                    {/* <InfoTooltip
                    content={`Your ${currentProvider.samlModalCopy} is the URL to your SAML provider's metadata. [Learn more.](https://dub.co/help/article/${selectedProvider}-saml#step-4-copy-the-metadata-url)`}
                  /> */}
                  </div>
                  <input
                    id="metadataUrl"
                    name="metadataUrl"
                    autoFocus={!isMobile}
                    type="url"
                    placeholder="https://"
                    autoComplete="off"
                    required
                    className="mt-1 block w-full appearance-none rounded-md border border-neutral-300 px-3 py-2 placeholder-neutral-400 shadow-sm focus:border-black focus:outline-none focus:ring-black sm:text-sm"
                  />
                </div>
              ))}
            <Button
              text="Save changes"
              className="text-white font-display"
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

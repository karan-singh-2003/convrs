"use client";
import { FileUpload, TooltipProvider } from "@repo/ui";
import { useState } from "react";
import { Button } from "@repo/ui";
import { toast } from "sonner";
import useWorkspace from "@/lib/swr/use-workspace";

export default function UploadLogo() {
  const { id, logo, isOwner } = useWorkspace();
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <TooltipProvider>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setUploading(true);

          fetch(`/api/workspaces/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ logo: image }),
          })
            .then(async (res) => {
              if (res.status === 200) {
                toast.success("Workspace logo updated successfully.");
              } else {
                const { error } = await res.json();
                toast.error(error || "Failed to update workspace logo");
              }
            })
            .finally(() => setUploading(false));
        }}
      >
        <div className="flex flex-col gap-5">
          {/* Heading */}
          <div className="space-y-1">
            <h2 className="font-medium text-sm font-display text-neutral-700">
              Workspace Logo
            </h2>

            <p className="text-sm font-display text-neutral-500 max-w-md">
              This is your workspace's logo on{" "}
              {process.env.NEXT_PUBLIC_APP_NAME}
            </p>
          </div>

          {/* Upload Section */}
          <div className="flex  flex-col items-start sm:items-center sm:flex-row sm:gap-6 gap-4">
            
            {/* Logo Upload */}
            <FileUpload
              accept="images"
              className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border border-neutral-300"
              iconClassName="w-5 h-5"
              variant="plain"
              imageSrc={image || logo}
              readFile
              onChange={({ src }) => setImage(src)}
              content={null}
              maxFileSizeMB={2}
              targetResolution={{ width: 240, height: 240 }}
            />

            {/* Controls */}
            <div className="flex flex-col gap-2 w-full sm:max-w-sm">
              <Button
                variant="primary"
                className="w-full sm:w-fit py-1 h-fit text-[13px] font-display"
                text="Save changes"
                loading={uploading}
                disabled={!isOwner || !image || image === logo}
                disabledTooltip={
                  !isOwner
                    ? "You are not the owner of this workspace."
                    : undefined
                }
              />

              <p className="text-[12.5px] font-default text-neutral-500  sm:text-left">
                Square image recommended. Accepted file types: .png, .jpg,
                .jpeg. Max file size: 2MB.
              </p>
            </div>
          </div>
        </div>
      </form>
    </TooltipProvider>
  );
}
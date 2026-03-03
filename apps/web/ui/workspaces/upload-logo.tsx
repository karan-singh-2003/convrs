"use client";
import { FileUpload } from "@repo/ui";
import { useState } from "react";
import { Button } from "@repo/ui";
import { toast } from "sonner";
import useWorkspace from "@/lib/swr/use-workspace";

export default function UploadLogo() {
  const { id, logo } = useWorkspace();
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        setUploading(true);
        e.preventDefault();
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
      <div className="flex flex-col gap-3">
        <div className="space-y-0.5">
          <h2 className="font-medium text-sm font-display text-neutral-600">Workspace Logo</h2>
          <p className="font-display text-[14px] text-neutral-500">
            This is your workspace's logo on {process.env.NEXT_PUBLIC_APP_NAME}
          </p>
        </div>
        <div className="mt-1 flex items-end gap-2">
          <FileUpload
            accept="images"
            className="h-24 w-24 rounded-full border border-neutral-300"
            iconClassName="w-5 h-5"
            variant="plain"
            imageSrc={image || logo}
            readFile
            onChange={({ src }) => setImage(src)}
            content={null}
            maxFileSizeMB={2}
            targetResolution={{ width: 240, height: 240 }}
          />
          <div className="mb-3">
            <Button
              className="h-fit py-1 w-fit text-[13px] font-default text-white disabled:text-black/50"
              text="save changes"
              loading={uploading}
              disabled={!image || image === logo}
            ></Button>
            <p className="text-[13px] text-neutral-500">
              Square Image Recommended. Accepted file types: .png, .jpg, .jpeg.
              Max file size: 2MB.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

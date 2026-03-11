"use client";
import { FileUpload } from "@repo/ui";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@repo/ui";

export default function UploadAvatar() {
  const { data: session, update } = useSession();
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (session?.user?.image) {
      setImage(session.user.image);
    }
  }, [session]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setUploading(true);

        fetch("/api/user", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image }),
        })
          .then(async (res) => {
            if (res.status === 200) {
              await update();
              toast.success("Avatar updated successfully");
            } else {
              const { error } = await res.json();
              toast.error(error || "Failed to update avatar");
            }
          })
          .finally(() => setUploading(false));
      }}
    >
      <div className="flex flex-col gap-4">
        {/* Heading */}
        <div className="space-y-1">
          <h2 className="font-medium text-sm">Avatar</h2>
          <p className="text-[13.5px] text-neutral-500 max-w-md">
            This is your avatar on {process.env.NEXT_PUBLIC_APP_NAME}
          </p>
        </div>

        {/* Upload section */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          
          <FileUpload
            accept="images"
            className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border border-neutral-300"
            iconClassName="w-5 h-5"
            variant="plain"
            imageSrc={image}
            readFile
            onChange={({ src }) => setImage(src)}
            content={null}
            maxFileSizeMB={2}
            targetResolution={{ width: 240, height: 240 }}
          />

          <div className="flex flex-col gap-2 sm:mb-3 max-w-sm">
            <Button
              className="h-fit py-1 w-full sm:w-fit text-[13px] font-default text-white disabled:text-black/50"
              text="Save changes"
              disabled={!image || image === session?.user?.image}
              loading={uploading}
            />

            <p className="text-[13px] text-neutral-500">
              Square image recommended. Accepted file types: .png, .jpg, .jpeg.
              Max file size: 2MB.
            </p>
          </div>

        </div>
      </div>
    </form>
  );
}
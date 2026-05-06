"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { Switch, Input } from "@repo/ui";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function PublicStats() {
  const [loading, setLoading] = useState(false);
  const { id, isPublic, publicId } = useWorkspace();

  const [enabled, setEnabled] = useState(isPublic ?? false);

  useEffect(() => {
    if (isPublic !== undefined) {
      setEnabled(isPublic);
    }
  }, [isPublic]);
  const handleToggle = async (next: boolean) => {
    setLoading(true);

    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isPublic: next }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "Failed");
      }

      toast.success(`Dashboard is now ${next ? "public" : "private"}`);
    } catch (error) {
      console.error(error);

      // rollback UI if failed
      setEnabled((prev) => !prev);

      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const shareUrl =
    publicId && typeof window !== "undefined"
      ? `${window.location.origin}/shared/${publicId}`
      : "";
  return (
    <div className="bg-white p-4 border-neutral-200 rounded-2xl border space-y-2">
      <div className="relative w-full flex justify-between items-center  ">
        <div className="space-y-0.5 font-display">
          <h2 className="font-medium text-neutral-600 text-sm">
            Public Dashboard
          </h2>
          <div className="font-default text-[13.5px] text-neutral-500">
            Share your project stats with the public.
          </div>
        </div>
        <Switch
          disabled={loading}
          checked={enabled || false}
          trackDimensions="radix-state-checked:bg-black focus-visible:ring-black/20 w-7 h-4"
          thumbDimensions="size-3"
          thumbTranslate="translate-x-3"
          fn={(value) => {
            setEnabled(value);
            handleToggle(value);
          }}
        />
      </div>
      {enabled && shareUrl && (
        <div className="mt-3">
          <Input readOnly value={shareUrl} />
        </div>
      )}
    </div>
  );
}

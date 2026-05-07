"use client";

import { EmptyState, LoadingSpinner, Wordmark } from "@repo/ui";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function ConfirmEmailChangePageClient() {
  const router = useRouter();
  const { update, status } = useSession();
  const hasUpdatedSession = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || hasUpdatedSession.current) {
      return;
    }

    async function updateSession() {
      hasUpdatedSession.current = true;
      await update();
      toast.success("Successfully updated your email!");
    }

    updateSession();
  }, [status, update]);

  return (
    <div className="max-w-sm mx-auto px-4 md:px-0 py-8 text-center">
      <div className="mb-5 flex justify-center">
        <Wordmark />
      </div>
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner className="size-6 animate-spin" />

        <h1 className="text-[20px] font-display font-semibold">
          Verifying Email Change
        </h1>

        <p className="text-muted-foreground text-[15px] font-display">
          Verifying your email change request. This might take a few seconds...
        </p>
      </div>
    </div>
  );
}

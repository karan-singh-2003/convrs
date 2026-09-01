"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { CopyButton } from "@repo/ui";

export default function ProjectToken() {
  const { projectToken } = useWorkspace();

  return (
    <div className="relative w-full rounded-2xl border border-border-subtle bg-bg-card p-4 space-y-2">
      <div className="space-y-0.5 font-display">
        <h2 className="text-sm font-medium text-content-default">
          Your Project Token
        </h2>

        <p className="text-[13px] font-default text-content-subtle">
          This is your unique project identifier on{" "}
          {process.env.NEXT_PUBLIC_APP_NAME}.
        </p>
      </div>

      {projectToken ? (
        <div className="flex w-full max-w-full items-center justify-between rounded-lg border border-border-subtle bg-bg-emphasis/70 px-3 py-1.5">
          <p className="font-display text-[14.5px] text-content-default">
            {projectToken}
          </p>

          <CopyButton
            value={projectToken}
            className="rounded-none text-content-default"
          />
        </div>
      ) : (
        <div className="h-[2.35rem] w-full max-w-md animate-pulse rounded-none bg-bg-emphasis" />
      )}
    </div>
  );
}
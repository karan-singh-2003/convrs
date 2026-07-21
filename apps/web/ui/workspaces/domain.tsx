"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { CopyButton } from "@repo/ui";

export default function Domain() {
  const { domain } = useWorkspace();

  return (
    <>
      <div className="relative w-full  bg-bg-default p-4 border-border-subtle rounded-2xl border space-y-2 ">
        <div className="space-y-0.5 font-display">
          <h2 className="font-medium text-content-default text-sm">
            Your Domain
          </h2>
          <p className="font-default text-[13px] text-content-subtle">
            This is your unique project identifier on{" "}
            {process.env.NEXT_PUBLIC_APP_NAME}.
          </p>
        </div>
        {domain ? (
          <div className="flex w-full max-w-full items-center justify-between rounded-none border border-border-subtle bg-bg-emphasis/70 px-3 py-1.5">
            <p className="text-[14.5px] font-display text-content-default">{domain}</p>
            <CopyButton value={domain} className="rounded-none" />
          </div>
        ) : (
          <div className="h-[2.35rem] w-full max-w-md animate-pulse rounded-none bg-neutral-200" />
        )}
      </div>
    </>
  );
}

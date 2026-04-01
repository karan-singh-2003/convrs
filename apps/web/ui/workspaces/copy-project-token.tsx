"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { CopyButton } from "@repo/ui";

export default function ProjectToken() {
  const { projectToken } = useWorkspace();

  return (
    <>
      <div className="relative w-full  bg-white p-4 border-neutral-200 rounded-2xl border space-y-2 ">
        <div className="space-y-0.5 font-display">
          <h2 className="font-medium text-neutral-600 text-sm">Your Project Token</h2>
          <p className="font-default text-[13px] text-neutral-500">
            This is your unique project identifier on{" "}
            {process.env.NEXT_PUBLIC_APP_NAME}.
          </p>
        </div>
        {projectToken ? (
          <div className="flex w-full max-w-full items-center justify-between rounded-none border border-neutral-300 bg-neutral-100 px-2 py-1">
            <p className="text-sm font-display text-neutral-500">{projectToken}</p>
            <CopyButton value={projectToken} className="rounded-none" />
          </div>
        ) : (
          <div className="h-[2.35rem] w-full max-w-md animate-pulse rounded-none bg-neutral-200" />
        )}
      </div>
    </>
  );
}

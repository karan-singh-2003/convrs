"use client";

import { CopyButton } from "@repo/ui";
import { useSession } from "next-auth/react";

export default function UserId() {
  const { data: session } = useSession() as
    | {
        data: { user: { id: string } };
      }
    | { data: null };

  return (
    <>
      <div className="relative  space-y-2 ">
        <div className="space-y-0.5">
          <h2 className="font-medium text-sm">Your User ID</h2>
          <p className="font-default text-[13.5px] text-neutral-500">
            This is your unique account identifier on{" "}
            {process.env.NEXT_PUBLIC_APP_NAME}.
          </p>
        </div>
        {session?.user?.id ? (
          <div className="flex w-full max-w-md items-center justify-between rounded-none border border-neutral-300 bg-white px-2 py-1">
            <p className="text-sm text-neutral-500">{session.user.id}</p>
            <CopyButton value={session.user.id} className="rounded-none" />
          </div>
        ) : (
          <div className="h-[2.35rem] w-full max-w-md animate-pulse rounded-md bg-neutral-200" />
        )}
      </div>
    </>
  );
}

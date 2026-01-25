"use client";
import React from "react";
import { Button } from "@repo/ui/button";
import { signOut, useSession } from "next-auth/react";
const SignedInHint = () => {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = React.useState(false);
  return (
    <div className="fixed top-0 right-0 z-40 m-5 flex flex-col gap-2">
      <div className="flex flex-col items-start leading-tight text-[12.5px] text-neutral-600">
        <p>You are signed in as{" "}</p>
        {session ? (
          <p className="font-semibold text-[13.5px] text-black">{session.user?.email}</p>
        ) : (
          <span className="h-3 w-32 animate-pulse rounded-none border border-neutral-300 bg-neutral-200" />
        )}
      </div>
      {/* <Button
        variant="primary"
        text="Sign In as Different User"
        onClick={() => {
          setIsLoading(true);
          signOut({
            callbackUrl: "/login",
          });
        }}
        className="h-8 w-fit text-white px-3 text-xs shadow-sm"
        loading={isLoading}
      >
        Sign Out
      </Button> */}
    </div>
  );
};

export default SignedInHint;

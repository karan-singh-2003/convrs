"use client";
import React from "react";
import { Button } from "@repo/ui";
import { signOut, useSession } from "next-auth/react";
const SignedInHint = () => {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = React.useState(false);
  return (
    <div className="fixed top-0 w-full justify-between p-3 flex items-center gap-2">
      <h1 className="font-medium text-base px-3 text-neutral-700 font-display">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 182 199"
          fill="none"
          className="size-6"
        >
          <path
            d="M0 50.837L90.3333 0L182 50.837V148.832L90.3333 199L0 148.832V50.837Z"
            fill="#363636"
          />
          <path
            d="M10 50.0038L90.1639 5L173 49.6679L90.832 94L10 50.0038Z"
            fill="white"
          />
        </svg>
      </h1>
      <div className="flex  items-center gap-2">
        <div className="flex flex-col items-start leading-tight text-[12.5px] font-display text-neutral-600">
          {session ? (
            <p className="font-medium text-[13.5px] text-neutral-600">
              {session.user?.email}
            </p>
          ) : null}
        </div>
        <Button
          variant="primary"
          text="Sign Out"
          onClick={() => {
            setIsLoading(true);
            signOut({
              callbackUrl: "/login",
            });
          }}
          className="h-fit py-1 w-fit font-display bg-[#FAFAFA] text-neutral-700 px-3 text-[14px] "
          loading={isLoading}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default SignedInHint;

"use client";
import React from "react";
import { Button } from "@repo/ui";
import { signOut, useSession } from "next-auth/react";

const SignedInHint = () => {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = React.useState(false);

  return (
    <div className="fixed top-0 left-0 w-full bg-white border-b">
      
      {/* Centered container */}
      <div className="mx-auto w-full max-w-4xl flex items-center justify-between px-4 sm:px-6 py-2">
        
        {/* Logo */}
        <h1 className="font-medium text-neutral-700 font-display flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 182 199"
            fill="none"
            className="size-5 sm:size-6"
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

        {/* Right section */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {session && (
            <p className="hidden sm:block max-w-[180px] truncate text-[13px] font-medium text-neutral-600">
              {session.user?.email || "You are signed in"}
            </p>
          )}

          <Button
            variant="primary"
            text="Sign Out"
            onClick={() => {
              setIsLoading(true);
              signOut({
                callbackUrl: "/login",
              });
            }}
            loading={isLoading}
            className="py-1 h-fit px-3 text-[13px] sm:text-[14px] bg-[#FAFAFA] text-neutral-700 font-display"
          >
            Sign Out
          </Button>
        </div>

      </div>
    </div>
  );
};

export default SignedInHint;
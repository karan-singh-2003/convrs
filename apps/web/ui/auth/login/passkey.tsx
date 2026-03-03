"use client";

import React, { useContext, useState } from "react";
import { signInWithPasskey } from "@teamhanko/passkeys-next-auth-provider/client";
import { Button } from "@repo/ui";
import { LoginFormContext } from "./login-form";
import { useSearchParams } from "next/navigation";

export const Passkey = ({ next }: { next?: string }) => {
  const searchParams = useSearchParams();
  const finalNext = next ?? searchParams?.get("next");

  const { setClickedMethod, clickedMethod, setLastUsedAuthMethod } =
    useContext(LoginFormContext);

  return (
    <div>
      <div className="relative">
        <Button
          text="Continue with a passkey"
          variant="secondary"
          onClick={async () => {
            setClickedMethod("passkey");
            setLastUsedAuthMethod("passkey");
            try {
              await signInWithPasskey({
                tenantId: process.env.NEXT_PUBLIC_HANKO_TENANT_ID as string,
                ...(finalNext && finalNext.length > 0
                  ? { callbackUrl: finalNext }
                  : {}),
              });
            } catch (error) {
              setClickedMethod(undefined);
              console.error("Passkey authentication failed:", error);
            }
          }}
          loading={clickedMethod === "passkey"}
          disabled={clickedMethod && clickedMethod !== "passkey"}
        />
      </div>
    </div>
  );
};



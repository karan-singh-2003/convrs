"use client";

import { AuthMethodsSeparator } from "../auth-methods-separator";
import { SignUpEmail } from "./sign-up-email";
import { SignUpOAuth } from "./sign-up-oauth";
import { AnimatedSizeContainer } from "@repo/ui/animated-size-container";

export const SignUpForm = ({
  methods = ["email", "google", "github"],
}: {
  methods?: ("email" | "google" | "github")[];
}) => {
  return (
    <AnimatedSizeContainer height>
      <div className="flex flex-col gap-3 p-1">
        <SignUpOAuth methods={methods} />
        {methods.length && <AuthMethodsSeparator />}
        {methods.includes("email") && <SignUpEmail />}
      </div>
    </AnimatedSizeContainer>
  );
};

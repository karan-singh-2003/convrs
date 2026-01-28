"use client";
import React from "react";
import { SignUpForm } from "@/ui/auth/register/sign-up-form";
import {
  RegisterProvider,
  useRegisterContext,
} from "@/ui/auth/register/context";
import { VerifyEmailForm } from "@/ui/auth/register/verify-email-form";

export default function RegisterPageClient() {
  return (
    <RegisterProvider>
      <RegisterFlow />
    </RegisterProvider>
  );
}

function SignUp() {
  return (
    <div className="max-w-sm mx-auto py-8">
      <SignUpForm />
      <p className="font-medium text-[14px] text-center mt-4 text-muted-foreground">
        Already have an account?{" "}
        <a href="/login" className="text-black">
          Log In
        </a>
      </p>
    </div>
  );
}

function Verify() {
  return (
    <>
      <div className="max-w-sm mx-auto py-8">
        <VerifyEmailForm />
      </div>
    </>
  );
}

const RegisterFlow = () => {
  const { step } = useRegisterContext();

  if (step === "signup") {
    return <SignUp />;
  }
  return <Verify />;
};

import React from "react";
import LoginForm from "@/ui/auth/login/login-form";
import { Suspense } from "react";
import { Wordmark } from "@repo/ui";
const LogIn = () => {
  return (
    <Suspense fallback={<div>Loading</div>}>
      <div className="max-w-sm mx-auto px-4   md:px-0 py-8">
        <div className="mb-5 flex justify-center">
          <Wordmark />
        </div>
        <div className="flex flex-col my-5 items-center justify-center">
          <h1 className="text-[20px] mt-4 text-neutral-700 font-display font-semibold">
            Let’s Get You Back In
          </h1>
          <h3 className="text-muted-foreground text-neutral-600 font-medium font-display text-[16px]">
            Log in to continue where you left off.
          </h3>
        </div>
        <LoginForm />
        <p className="font-medium text-[14px] text-neutral-600 font-display text-center mt-5 text-muted-foreground">
          Don't have an account?{" "}
          <a href="/register" className="text-neutral-700 hover:underline">
            Sign Up
          </a>
        </p>
      </div>
    </Suspense>
  );
};

export default LogIn;

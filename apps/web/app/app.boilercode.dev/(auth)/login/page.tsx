import React from "react";
import LoginForm from "@/ui/auth/login/login-form";
import { Suspense } from "react";
const LogIn = () => {
  return (
    <Suspense fallback={<div>Loading</div>}>
      <div className="max-w-sm mx-auto py-8">
        <div className="flex flex-col my-5 items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 182 199"
            fill="none"
            className="size-8"
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

          <h1 className="text-[20px] mt-4 font-display font-semibold">
            Let’s Get You Back In
          </h1>
          <h3 className="text-muted-foreground font-medium font-display text-[16px]">
            Log in to continue where you left off.
          </h3>
        </div>
        <LoginForm />
        <p className="font-medium text-[14px] font-display text-center mt-5 text-muted-foreground">
          Don't have an account?{" "}
          <a href="/register" className="text-black">
            Sign Up
          </a>
        </p>
      </div>
    </Suspense>
  );
};

export default LogIn;

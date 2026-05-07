import React, { Suspense } from "react";
import NextButton from "../next-button";
import Image from "next/image";
export const dynamic = "force-dynamic";

const page = () => {
  return (
    <Suspense fallback={<div>Loading</div>}>
      <div className="relative flex min-h-[90vh] w-full max-w-md mx-auto gap-y-5 flex-col items-center justify-center px-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 182 199"
          fill="none"
          className="size-24"
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
        <div className="flex flex-col items-center justify-center">
          <h1 className="font-display font-semibold text-lg sm:text-xl text-neutral-600 text-center">
            {" "}
            Welcome to Boilercode
          </h1>
          <h1 className="font-display font-medium text-sm sm:text-base text-center text-neutral-500">
            Everything you need to build secure, production-grade SaaS out of
            the box
          </h1>
        </div>
        <NextButton step="workspace" text="Get Started" />
      </div>
    </Suspense>
  );
};

export default page;

import React, { Suspense } from "react";
import NextButton from "../next-button";
import Image from "next/image";
export const dynamic = "force-dynamic";

const page = () => {
  return (
    <Suspense fallback={<div>Loading</div>}>
      <div className="relative flex min-h-[90vh] max-w-md mx-auto gap-y-5  flex-col items-center justify-center">
        <Image
          src="/logo.svg"
          alt="welcome"
          width={150}
          height={150}
        />
        <div className="flex flex-col items-center justify-center">
          <h1 className="font-display font-semibold text-xl text-neutral-600">
            {" "}
            Welcome to Boilercode
          </h1>
          <h1 className="font-display font-medium text-base text-center text-neutral-500">
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

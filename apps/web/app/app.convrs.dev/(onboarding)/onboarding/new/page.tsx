import React, { Suspense } from "react";
import NextButton from "../next-button";
import Image from "next/image";
export const dynamic = "force-dynamic";

const page = () => {
  return (
    <Suspense fallback={<div>Loading</div>}>
      <div className="relative flex min-h-[90vh] w-full max-w-md mx-auto gap-y-5 flex-col items-center justify-center px-4">
        <svg
          width="102"
          height="100"
          viewBox="0 0 102 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="102" height="100" fill="black" />
          <path
            d="M32.776 48.248C32.776 44.984 33.528 42.056 35.032 39.464C36.568 36.872 38.632 34.856 41.224 33.416C43.848 31.944 46.712 31.208 49.816 31.208C53.368 31.208 56.52 32.088 59.272 33.848C62.056 35.576 64.072 38.04 65.32 41.24H58.744C57.88 39.48 56.68 38.168 55.144 37.304C53.608 36.44 51.832 36.008 49.816 36.008C47.608 36.008 45.64 36.504 43.912 37.496C42.184 38.488 40.824 39.912 39.832 41.768C38.872 43.624 38.392 45.784 38.392 48.248C38.392 50.712 38.872 52.872 39.832 54.728C40.824 56.584 42.184 58.024 43.912 59.048C45.64 60.04 47.608 60.536 49.816 60.536C51.832 60.536 53.608 60.104 55.144 59.24C56.68 58.376 57.88 57.064 58.744 55.304H65.32C64.072 58.504 62.056 60.968 59.272 62.696C56.52 64.424 53.368 65.288 49.816 65.288C46.68 65.288 43.816 64.568 41.224 63.128C38.632 61.656 36.568 59.624 35.032 57.032C33.528 54.44 32.776 51.512 32.776 48.248Z"
            fill="white"
          />
        </svg>

        <div className="flex flex-col items-center justify-center">
          <h1 className="font-display font-semibold text-lg sm:text-xl text-neutral-600 text-center">
            {" "}
            Welcome to Convrs
          </h1>
          <h1 className="font-display font-medium text-sm sm:text-base text-center text-neutral-500">
            Let's get you set up in a few easy steps
          </h1>
        </div>
        <NextButton step="workspace" text="Get Started" />
      </div>
    </Suspense>
  );
};

export default page;

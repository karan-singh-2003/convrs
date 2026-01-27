import React, { Suspense } from "react";
import NextButton from "../next-button";
const page = () => {
  return (
    <Suspense fallback={<div>Loading</div>}>
      <div className="relative flex min-h-screen flex-col items-center justify-center">
        Welcome to the onboarding welcome page
        <NextButton step="workspace" text="Next" />
      </div>
    </Suspense>
  );
};

export default page;

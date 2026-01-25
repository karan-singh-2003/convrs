import React from "react";
import NextButton from "../next-button";
const page = () => {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center">
      Welcome to the onboarding welcome page
      <NextButton step="workspace" text="Next" />
    </div>
  );
};

export default page;

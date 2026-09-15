"use client";
import React from "react";
import Theme from "./theme";
import { AnimatedSizeContainer } from "@repo/ui";
const page = () => {
  return (
    <div>
      <AnimatedSizeContainer height>
        <Theme />
      </AnimatedSizeContainer>
    </div>
  );
};

export default page;

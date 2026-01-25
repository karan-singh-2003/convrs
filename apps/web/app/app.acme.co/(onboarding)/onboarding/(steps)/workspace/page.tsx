import React, { Suspense } from "react";
import { Form } from "./form";

export const dynamic = "force-dynamic";

const page = () => {
  return (
    <div className=" flex items-center justify-center h-screen mx-auto">
      <Suspense fallback={<div>Loading...</div>}>
        <Form />
      </Suspense>
    </div>
  );
};

export default page;

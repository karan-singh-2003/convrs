import { Suspense } from "react";
import { Form } from "./form";
import { SkipButton } from "../../skip-button";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading</div>}>
      <div className="flex flex-col items-center top-16 sm:top-16 relative h-fit w-full  max-w-sm md:max-w-[25rem] mx-auto md:px-0 px-4">
        <h1 className="font-display text-neutral-600 font-semibold    text-base sm:text-[18px] text-center">
          Invite Your Team
        </h1>
        <h3 className="text-muted-foreground font-medium font-display text-center text-sm sm:text-[14.5px]">
          Add team members to collaborate inside your workspace.
        </h3>
        <div className="my-4  w-full">
          <Form />
        </div>
      </div>
      <div className="mt-2 flex justify-center">
        <SkipButton step="source" />
      </div>
    </Suspense>
  );
}

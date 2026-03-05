import { Suspense } from "react";
import { Form } from "./form";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <div className="flex flex-col items-center top-20 relative  h-fit max-w-sm mx-auto">
        <h1 className="font-display text-neutral-600 font-semibold text-[18px]">
          Create Your Workspace
        </h1>
        <h3 className="text-muted-foreground font-medium font-display text-center text-[14.5px]">
          Add a logo, choose a name, and we’ll generate a unique URL for you.
        </h3>
        <div className="my-4">
          <Form />
        </div>
      </div>
    </Suspense>
  );
}

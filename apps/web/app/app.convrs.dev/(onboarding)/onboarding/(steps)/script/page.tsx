import { Suspense } from "react";
import ScriptSettingsPage from "./page-client";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <div className="flex flex-col items-center top-16 sm:top-16 relative h-fit w-full max-w-sm md:max-w-[30rem] mx-auto px-4 md:px-0">
        <h1 className="font-display text-neutral-500 font-semibold text-base sm:text-[18px] text-center">
          Install the Script
        </h1>

        <h3 className="text-muted-foreground font-medium my-1 font-display text-neutral-600 text-center text-sm sm:text-[14.5px]">
          Paste the following script tag into the{" "}
          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">
            &lt;head&gt;
          </code>{" "}
          of your website to enable analytics tracking.
        </h3>
        <div className="my-4 w-full">
          <ScriptSettingsPage />
        </div>
      </div>
    </Suspense>
  );
}

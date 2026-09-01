// "use client";

// import useWorkspace from "@/lib/swr/use-workspace";
// import { CopyButton } from "@repo/ui";

// export default function Domain() {
//   const { domain } = useWorkspace();

//   return (
//     <>
//       <div className="relative w-full  bg-bg-card p-4 border-border-subtle rounded-2xl border space-y-2 ">
//         <div className="space-y-0.5 font-display">
//           <h2 className="font-medium text-content-default text-sm">
//             Your Domain
//           </h2>
//           <p className="font-default text-[13px] text-content-subtle">
//             This is your unique project identifier on{" "}
//             {process.env.NEXT_PUBLIC_APP_NAME}.
//           </p>
//         </div>
//         {domain ? (
//           <div className="flex w-full max-w-full items-center justify-between rounded-lg border border-border-subtle bg-bg-emphasis/70 px-3 py-1.5">
//             <p className="text-[14.5px] font-display text-content-default">{domain}</p>
//             <CopyButton value={domain} className="rounded-none" />
//           </div>
//         ) : (
//           <div className="h-[2.35rem] w-full max-w-md animate-pulse rounded-none bg-neutral-200" />
//         )}
//       </div>
//     </>
//   );
// }

"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { Button, CopyButton } from "@repo/ui";

export default function Domain() {
  const { domain } = useWorkspace();

  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-card">
      <div className="space-y-3 p-4">
        <div className="space-y-0.5 font-display">
          <h2 className="text-sm font-medium text-content-default">
            Your Domain
          </h2>

          <p className="text-[13px] text-content-subtle">
            This is your unique project identifier on{" "}
            {process.env.NEXT_PUBLIC_APP_NAME}.
          </p>
        </div>

        {domain ? (
          <div className="flex w-full items-center justify-between rounded-lg border border-border-subtle bg-bg-emphasis/70 px-3 py-1.5">
            <p className="min-w-0 truncate text-[14.5px] font-display text-content-default">
              {domain}
            </p>

            <CopyButton value={domain} className="shrink-0 rounded-none" />
          </div>
        ) : (
          <div className="h-[2.35rem] w-full max-w-md animate-pulse rounded-lg bg-bg-emphasis" />
        )}
      </div>

      <div className="flex justify-end border-t border-border-subtle px-4 py-2">
        <Button
          text="Update Domain"
          className="h-9 w-fit bg-bg-emphasis text-content-inverse border-none rounded-full text-sm font-display"
          // className="h-9 w-fit rounded-full px-5 text-sm font-display"
        />
      </div>
    </div>
  );
}
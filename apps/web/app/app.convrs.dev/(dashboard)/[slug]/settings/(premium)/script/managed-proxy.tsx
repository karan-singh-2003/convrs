// import Form from "@/ui/shared/form";

// export default function ManagedProxy() {
//     return (
//         <Form
//             title="Managed Proxy"
//             description={`Route your tracking script through convrs.dev to bypass ad blockers.`}
//             inputAtts={{
//                 name: "proxy sub-domain",
//                 placeholder: "a.convrs.dev",
//             }}
//             buttonText="Enable Managed Proxy"
//             disabledTooltip={undefined}
//             handleSubmit={async (data) => {
//                 console.log("data", data)
//             }}
//         ></Form>
//     );
// }



// "use client";
// import { useState } from "react";
// import { Input, Button, TooltipProvider } from "@repo/ui";
// import { Copy, Check, X } from "lucide-react";
// import useWorkspace from "@/lib/swr/use-workspace";
// import { toast } from "sonner";
// import useSWR from "swr";


// type ProxyDomain = {
//     id: string;
//     subdomain: string;
//     status: "pending" | "active" | "error";
//     cnameTarget: string;
//     verification: { type: string; domain: string; value: string }[] | null;
// };

// const fetcher = (url: string) => fetch(url).then((res) => res.json());

// function CopyableRow({ type, name, value }: { type: string; name: string; value: string }) {
//     const [copied, setCopied] = useState(false);
//     return (
//         <tr className="border-t border-border-subtle">
//             <td className="py-2 pr-4 text-content-subtle text-[13px]">{type}</td>
//             <td className="py-2 pr-4 text-content-default text-[13px] font-mono">{name}</td>
//             <td className="py-2 pr-2 text-content-default text-[13px] font-mono">
//                 <div className="flex items-center gap-2">
//                     <span className="truncate max-w-[220px]">{value}</span>
//                     <button
//                         type="button"
//                         onClick={() => {
//                             navigator.clipboard.writeText(value);
//                             setCopied(true);
//                             setTimeout(() => setCopied(false), 1500);
//                         }}
//                         className="text-content-subtle hover:text-content-default shrink-0"
//                     >
//                         {copied ? <Check size={14} /> : <Copy size={14} />}
//                     </button>
//                 </div>
//             </td>
//         </tr>
//     );
// }

// function StatusBadge({ status }: { status: ProxyDomain["status"] }) {
//     const styles = {
//         pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
//         active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
//         error: "bg-red-500/10 text-red-500 border-red-500/20",
//     }[status];
//     const label = { pending: "Pending", active: "Active", error: "Error" }[status];
//     return (
//         <span className={`inline-flex items-center gap-1.5 font-display rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${styles}`}>
//             <span className="w-1.5 h-1.5 rounded-full bg-current" />
//             {label}
//         </span>
//     );
// }

// export default function ManagedProxyCard() {
//     const { id: workspaceId } = useWorkspace();

//     const { data: domain, isLoading, mutate } = useSWR<ProxyDomain | null>(
//         workspaceId ? `/api/workspaces/${workspaceId}/proxy-domain` : null,
//         fetcher,
//     );

//     const [subdomain, setSubdomain] = useState("");
//     const [saving, setSaving] = useState(false);
//     const [checking, setChecking] = useState(false);

//     const enable = async () => {
//         setSaving(true);
//         const res = await fetch(`/api/workspaces/${workspaceId}/proxy-domain`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ subdomain }),
//         });
//         const data = await res.json();
//         setSaving(false);
//         if (!res.ok) return toast(data.error);
//         mutate(data, false); // update local cache immediately, no need to refetch
//     };

//     const checkStatus = async () => {
//         setChecking(true);
//         const res = await fetch(`/api/workspaces/${workspaceId}/proxy-domain/verify`);
//         const data = await res.json();
//         setChecking(false);
//         if (res.ok) mutate(data, false);
//     };

//     const remove = async () => {
//         if (!domain) return;
//         await fetch(`/api/workspaces/${workspaceId}/proxy-domain`, {
//             method: "DELETE",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ subdomain: domain.subdomain }),
//         });
//         setSubdomain("");
//         mutate(null, false);
//     };

//     if (isLoading) {
//         return (
//             <div className="bg-bg-default border border-border-subtle rounded-xl p-4 h-[140px] animate-pulse" />
//         );
//     }

//     return (
//         <TooltipProvider>
//             <div className="bg-bg-default border border-border-subtle rounded-xl  space-y-4">
//                 <div className="flex items-start justify-between px-4 pt-4">
//                     <div className="space-y-0.5">
//                         <h2 className="font-medium text-sm font-display text-content-default">Managed Proxy</h2>
//                         <p className="text-[14px] font-display text-content-subtle">
//                             Route your tracking script through convrs.dev to bypass ad blockers.
//                         </p>
//                         <a href="/docs/managed-proxy" className="text-[13px] text-content-subtle underline underline-offset-2">
//                             Learn more
//                         </a>
//                     </div>
//                     {domain && <StatusBadge status={domain.status} />}
//                 </div>

//                 {!domain ? (
//                     <div className="">
//                         <div className="px-4 pb-4">
//                             <Input
//                                 name="subdomain"
//                                 placeholder="a.convrs.dev"
//                                 value={subdomain}
//                                 onChange={(e) => setSubdomain(e.target.value)}
//                                 className="w-full font-display text-neutral-600"
//                             />
//                         </div>


//                         <div className="flex p-4 justify-end border-t border-t-border-subtle pt-4">
//                             <Button
//                                 type="button"
//                                 text="Enable"
//                                 loading={saving}
//                                 onClick={enable}
//                                 disabled={!subdomain}
//                                 className="h-9 w-24 rounded-full font-display text-sm"
//                             />
//                         </div>

//                     </div>
//                 ) : (
//                     <div className="px-5">
//                         <div className="flex items-center justify-between border border-border-subtle rounded-lg px-3 py-2">
//                             <span className="font-mono text-[13px] text-content-default">{domain.subdomain}</span>
//                             <button onClick={remove} className="text-content-subtle hover:text-content-default">
//                                 <X size={14} />
//                             </button>
//                         </div>

//                         <div className="mt-6">
//                             <p className="text-[13px] font-display text-content-subtle mb-2">
//                                 Add this DNS record to your domain registrar:
//                             </p>
//                             <table className="w-full">
//                                 <thead>
//                                     <tr>
//                                         <th className="text-left text-[12px] text-content-subtle font-normal pb-1">Type</th>
//                                         <th className="text-left text-[12px] text-content-subtle font-normal pb-1">Name</th>
//                                         <th className="text-left text-[12px] text-content-subtle font-normal pb-1">Value</th>
//                                     </tr>
//                                 </thead>
//                                 <tbody>
//                                     <CopyableRow
//                                         type="CNAME"
//                                         name={domain.subdomain.split(".")[0]}
//                                         value={domain.cnameTarget}
//                                     />
//                                 </tbody>
//                             </table>
//                         </div>

//                         {domain.verification && domain.verification.length > 0 && (
//                             <div className="mt-6">
//                                 <p className="text-[13px] font-display text-content-subtle mb-2">
//                                     This domain was used on another Vercel account. Add this TXT record to verify
//                                     ownership (you can remove it after verification):
//                                 </p>
//                                 <table className="w-full">
//                                     <thead>
//                                         <tr>
//                                             <th className="text-left text-[12px] text-content-subtle font-normal pb-1">Type</th>
//                                             <th className="text-left text-[12px] text-content-subtle font-normal pb-1">Name</th>
//                                             <th className="text-left text-[12px] text-content-subtle font-normal pb-1">Value</th>
//                                         </tr>
//                                     </thead>
//                                     <tbody>
//                                         {domain.verification.map((v) => (
//                                             <CopyableRow key={v.domain} type={v.type} name={v.domain} value={v.value} />
//                                         ))}
//                                     </tbody>
//                                 </table>
//                             </div>
//                         )}

//                         <div className="flex border-t border-border-subtle items-center mt-6 justify-between py-4">
//                             <p className="text-[13px] font-display text-content-subtle">
//                                 Propagation usually takes 1–10 minutes. SSL is auto-issued after DNS and TXT verification.
//                             </p>
//                             <Button
//                                 type="button"
//                                 variant="secondary"
//                                 loading={checking}
//                                 text="Check status"
//                                 onClick={checkStatus}
//                                 className="h-8 px-3 rounded-full w-fit text-[13px] font-display"
//                             />
//                         </div>
//                     </div>
//                 )}

//                 {/* {error && <p className="text-[13px] text-red-500">{error}</p>} */}
//             </div>
//         </TooltipProvider>
//     );
// }

"use client";
import { useState } from "react";
import { Input, Button, TooltipProvider } from "@repo/ui";
import { Copy, Check, X } from "lucide-react";
import useWorkspace from "@/lib/swr/use-workspace";
import { toast } from "sonner";
import useSWR from "swr";

type ProxyDomain = {
  id: string;
  subdomain: string;
  status: "pending" | "active" | "error";
  cnameTarget: string;
  verification: { type: string; domain: string; value: string }[] | null;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function CopyableRow({ type, name, value }: { type: string; name: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <tr className="border-t border-border-subtle">
      <td className="py-2 pr-4 text-content-subtle text-[13px]">{type}</td>
      <td className="py-2 pr-4 text-content-default text-[13px] font-mono">{name}</td>
      <td className="py-2 pr-2 text-content-default text-[13px] font-mono">
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[220px]">{value}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-content-subtle hover:text-content-default shrink-0"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: ProxyDomain["status"] }) {
  const styles = {
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    error: "bg-red-500/10 text-red-500 border-red-500/20",
  }[status];
  const label = { pending: "Pending", active: "Active", error: "Error" }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 font-display rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${styles}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export default function ManagedProxyCard() {
  const { id: workspaceId } = useWorkspace();

  const { data: domain, isLoading, mutate } = useSWR<ProxyDomain | null>(
    workspaceId ? `/api/workspaces/${workspaceId}/proxy-domain` : null,
    fetcher,
  );

  const [subdomain, setSubdomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  const enable = async () => {
    setSaving(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/proxy-domain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subdomain }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return toast(data.error);
    mutate(data, false);
  };

  const checkStatus = async () => {
    setChecking(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/proxy-domain/verify`);
    const data = await res.json();
    setChecking(false);
    if (res.ok) mutate(data, false);
  };

  const remove = async () => {
    if (!domain) return;
    await fetch(`/api/workspaces/${workspaceId}/proxy-domain`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subdomain: domain.subdomain }),
    });
    setSubdomain("");
    mutate(null, false);
  };

  if (isLoading) {
    return (
      <div className="bg-bg-default border border-border-subtle rounded-xl p-4 h-[140px] animate-pulse" />
    );
  }

  return (
    <TooltipProvider>
      <div className="bg-bg-default border border-border-subtle rounded-xl space-y-4">
        <div className="flex items-start justify-between px-4 pt-4">
          <div className="space-y-0.5">
            <h2 className="font-medium text-sm font-display text-content-default">Managed Proxy</h2>
            <p className="text-[14px] font-display text-content-subtle">
              Route your tracking script through convrs.dev to bypass ad blockers.
            </p>
            <a href="/docs/managed-proxy" className="text-[13px] text-content-subtle underline underline-offset-2">
              Learn more
            </a>
          </div>
          {domain && <StatusBadge status={domain.status} />}
        </div>

        {!domain ? (
          <div>
            <div className="px-4 pb-4">
              <Input
                name="subdomain"
                placeholder="a.convrs.dev"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                className="w-full font-display text-neutral-600"
              />
            </div>
            <div className="flex p-4 justify-end border-t border-t-border-subtle pt-4">
              <Button
                type="button"
                text="Enable"
                loading={saving}
                onClick={enable}
                disabled={!subdomain}
                className="h-9 w-24 rounded-full font-display text-sm"
              />
            </div>
          </div>
        ) : domain.status === "active" ? (
          // ACTIVE STATE — compact confirmation, no outstanding instructions
          <div className="px-5 pb-4 space-y-3">
            <div className="flex items-center justify-between border border-border-subtle rounded-lg px-3 py-2">
              <span className="font-mono text-[14.5px] text-content-default">{domain.subdomain}</span>
              <button onClick={remove} className="text-content-subtle hover:text-content-default">
                <X size={14} />
              </button>
            </div>
            <p className="text-[12px] font-display text-content-subtle">
              Proxy is active. Your tracking script should now load from{" "}
              <span className="font-mono">{domain.subdomain}</span>.
            </p>
            <details className="text-[12.5px]  font-display text-content-subtle">
              <summary className="cursor-pointer  select-none">View DNS record</summary>
              <table className="w-full mt-2">
                <tbody>
                  <CopyableRow
                    type="CNAME"
                    name={domain.subdomain.split(".")[0]}
                    value={domain.cnameTarget}
                  />
                </tbody>
              </table>
            </details>
          </div>
        ) : (
          // PENDING / ERROR STATE — full instructions, same as before
          <div className="px-5">
            <div className="flex items-center justify-between border border-border-subtle rounded-lg px-3 py-2">
              <span className="font-mono text-[14.5px] text-content-default">{domain.subdomain}</span>
              <button onClick={remove} className="text-content-subtle hover:text-content-default">
                <X size={14} />
              </button>
            </div>

            <div className="mt-6">
              <p className="text-[13px] font-display text-content-subtle mb-2">
                Add this DNS record to your domain registrar:
              </p>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left text-[12px] text-content-subtle font-normal pb-1">Type</th>
                    <th className="text-left text-[12px] text-content-subtle font-normal pb-1">Name</th>
                    <th className="text-left text-[12px] text-content-subtle font-normal pb-1">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <CopyableRow
                    type="CNAME"
                    name={domain.subdomain.split(".")[0]}
                    value={domain.cnameTarget}
                  />
                </tbody>
              </table>
            </div>

            {domain.verification && domain.verification.length > 0 && (
              <div className="mt-6">
                <p className="text-[13px] font-display text-content-subtle mb-2">
                  This domain was used on another Vercel account. Add this TXT record to verify
                  ownership (you can remove it after verification):
                </p>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-[12px] text-content-subtle font-normal pb-1">Type</th>
                      <th className="text-left text-[12px] text-content-subtle font-normal pb-1">Name</th>
                      <th className="text-left text-[12px] text-content-subtle font-normal pb-1">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domain.verification.map((v) => (
                      <CopyableRow key={v.domain} type={v.type} name={v.domain} value={v.value} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex border-t border-border-subtle items-center mt-6 justify-between py-4">
              <p className="text-[13px] font-display text-content-subtle">
                Propagation usually takes 1–10 minutes. SSL is auto-issued after DNS and TXT verification.
              </p>
              <Button
                type="button"
                variant="secondary"
                loading={checking}
                text="Check status"
                onClick={checkStatus}
                className="h-8 px-3 rounded-full w-fit text-[13px] font-display"
              />
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
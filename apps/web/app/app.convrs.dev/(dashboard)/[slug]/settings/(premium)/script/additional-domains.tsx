"use client";
import { useState } from "react";
import Form from "@/ui/shared/form";
import { Switch } from "@repo/ui";
import { X } from "lucide-react";
import useSWR from "swr";
import useWorkspace from "@/lib/swr/use-workspace";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function AdditionalDomains() {
  const { id: workspaceId } = useWorkspace();
  const { data, mutate } = useSWR<{ allowedHostnames: string[]; allowAllDomains: boolean }>(
    workspaceId ? `/api/workspace/${workspaceId}/allowed-domains` : null,
    fetcher,
  );
  const [toggling, setToggling] = useState(false);

  const addDomain = async (domain: string): Promise<void> => {
    const res = await fetch(`/api/workspace/${workspaceId}/allowed-domains`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    const result = await res.json();
    if (!res.ok) {
      toast(result.error);
      return;
    }
    mutate(result, false);
  };

  const removeDomain = async (domain: string): Promise<void> => {
    const res = await fetch(`/api/workspace/${workspaceId}/allowed-domains`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    const result = await res.json();
    mutate(result, false);
  };

  const toggleAllowAll = async (checked: boolean): Promise<void> => {
    setToggling(true);
    const res = await fetch(`/api/workspace/${workspaceId}/allowed-domains`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowAllDomains: checked }),
    });
    setToggling(false);
    const result = await res.json();
    mutate(result, false);
  };

  return (
    <Form
      title="Add Additional Domains"
      description="Add domains to allow sending analytics data to this website."
      inputAtts={{ name: "domain", placeholder: "www.example.com" }}
      buttonText="Add Domain"
      disabledTooltip={undefined}
      handleSubmit={async (data) => addDomain(data.domain)}
    >
      {data?.allowedHostnames && data.allowedHostnames.length > 0 && (
        <div className="mt-3 space-y-2">
          {data.allowedHostnames.map((d) => (
            <div key={d} className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2">
              <span className="font-mono text-[13px] text-content-default">{d}</span>
              <button onClick={() => removeDomain(d)} className="text-content-subtle hover:text-content-default">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-border-subtle bg-bg-subtle p-3 sm:p-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-sm font-medium text-content-default">Allow all domains</h3>
            <p className="mt-1 font-display text-[13px] leading-5 text-content-subtle sm:text-[13.5px]">
              Useful for embedded widgets and custom domains.
            </p>
          </div>
          <div className="flex justify-end sm:justify-start">
            <Switch
              checked={data?.allowAllDomains ?? false}
              disabled={toggling}
              fn={toggleAllowAll}
              trackDimensions="h-4 w-7 radix-state-checked:bg-bg-inverted focus-visible:ring-border-default"
              thumbDimensions="size-3.5"
              thumbTranslate="translate-x-3"
            />
          </div>
        </div>
      </div>
    </Form>
  );
}
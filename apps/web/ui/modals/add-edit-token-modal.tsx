"use client";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useState,
  useEffect,
  useMemo,
} from "react";
import { Scope, SCOPE_PRESETS } from "@/lib/api/tokens/scopes";
import { Input, Modal, ToggleGroup } from "@repo/ui";
import { Label, Button, RadioGroup, RadioGroupItem } from "@repo/ui";
import useWorkspace from "@/lib/swr/use-workspace";
import { cn } from "@repo/utils";
import { toast } from "sonner";
import { RESOURCES } from "@/lib/api/rbac/resources";
import { RESOURCE_SCOPES } from "@/lib/api/tokens/scopes";
import { mutate } from "swr";

type ScopePreset = "all_access" | "read_only" | "restricted";

type APIKeyProps = {
  id?: string;
  name: string;
  scopes: { [key: string]: Scope };
  isMachine: boolean;
};

const newToken: APIKeyProps = {
  name: "",
  scopes: { api: "apis.all" },
  isMachine: false,
};

function AddEditTokenModal({
  showAddEditTokenModal,
  setShowAddEditTokenModal,
  token,
  onTokenCreated,
  setSelectedToken,
}: {
  showAddEditTokenModal: boolean;
  setShowAddEditTokenModal: Dispatch<SetStateAction<boolean>>;
  token?: APIKeyProps;
  onTokenCreated?: (token: string) => void;
  setSelectedToken?: (value: undefined) => void;
}) {
  const [data, setData] = useState<APIKeyProps>(token || newToken);
  const { isOwner, role, id: workspaceId } = useWorkspace();

  const derivePreset = (scopes: { [key: string]: Scope }): ScopePreset => {
    const vals = Object.values(scopes);
    if (vals.includes("apis.all")) return "all_access";
    if (vals.includes("apis.read")) return "read_only";
    return "restricted";
  };

  const [preset, setPreset] = useState<ScopePreset>(
    token ? derivePreset(token.scopes) : "all_access"
  );
  const [saving, setSaving] = useState(false);

  const { name, scopes } = data;

  const endpoint = useMemo(() => {
    if (token) {
      return {
        method: "PATCH",
        url: `/api/tokens/${token.id}?workspaceId=${workspaceId}`,
        successMessage: "Token updated successfully",
      };
    } else {
      return {
        method: "POST",
        url: `/api/tokens?workspaceId=${workspaceId}`,
        successMessage: "Token created successfully",
      };
    }
  }, [token]);

  const onsubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const response = await fetch(endpoint.url, {
      method: endpoint.method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...data,
        scopes: Object.values(scopes).filter((v) => v),
      }),
    });
    const result = await response.json();
    if (response.ok) {
      setShowAddEditTokenModal(false);
      setSelectedToken?.(undefined);
      toast.success(endpoint.successMessage);
      mutate(`/api/tokens?workspaceId=${workspaceId}`);
      if (!token) {
        onTokenCreated?.(result.token);
      }
    }
    setSaving(false);
  };

  const scopeByResources = useMemo(() => {
    const resourceMap = new Map<
      string,
      { name: string; key: string; scopes: Scope[] }
    >();
    RESOURCE_SCOPES.forEach((entry) => {
      if (!entry.resource) return;
      const key = entry.resource;
      if (!resourceMap.has(key)) {
        const meta = RESOURCES.find((r) => r.key === key);
        resourceMap.set(key, { name: meta?.name ?? key, key, scopes: [] });
      }
      resourceMap.get(key)!.scopes.push(...entry.scope);
    });
    return Array.from(resourceMap.values());
  }, []);

  const scopePresets = useMemo(() => {
    const presetValues: ScopePreset[] = [
      "all_access",
      "read_only",
      "restricted",
    ];
    return SCOPE_PRESETS.map((p, i) => ({
      value: presetValues[i],
      label: p.name,
    }));
  }, []);
  console.log("derive preset", derivePreset(token?.scopes || {}), token);
  useEffect(() => {
    if (token) {
      setData(token);
      setPreset(derivePreset(token.scopes));
    } else {
      setData(newToken);
      setPreset("all_access");
    }
  }, [token]);
  return (
    <>
      <Modal
        showModal={showAddEditTokenModal}
        setShowModal={setShowAddEditTokenModal}
        className="px-4 md:px-0 py-3 md:py-1.5 max-h-[90vh] md:max-h-[95dvh] md:overflow-y-auto"
      >
        {/* Header */}
        <div className="space-y-1 md:py-1 py-2 md:border-b border-[#F0F0F0]">
          <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-black/65">
            {token ? "Edit" : "Create New"} API Key
          </h3>
        </div>

        <form
          onSubmit={onsubmit}
          className="flex flex-col gap-5 md:px-5 md:py-4"
        >
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium font-display text-neutral-600">
              Name
            </Label>

            <Input
              id="name"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              required
              autoFocus
              autoComplete="off"
            />
          </div>

          {/* Permissions */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium font-display text-neutral-600">
              Permissions
            </Label>

            <ToggleGroup
              options={scopePresets}
              selected={preset}
              className="grid grid-cols-3"
              optionClassName="w-full h-9 flex items-center justify-center text-sm font-display"
              selectAction={(value: ScopePreset) => {
                setPreset(value);

                if (value === "all_access") {
                  setData({ ...data, scopes: { api: "apis.all" } });
                } else if (value === "read_only") {
                  setData({ ...data, scopes: { api: "apis.read" } });
                } else {
                  setData({ ...data, scopes: {} });
                }
              }}
            />
          </div>

          {/* Permission Description */}
          <p className="text-[13px] md:text-[14.5px] font-display text-neutral-500 leading-relaxed">
            {preset === "all_access" &&
              "This API key will have full access to all API features."}

            {preset === "read_only" &&
              "This API key will have read-only access to all API features."}

            {preset === "restricted" &&
              "Choose specific permissions for each resource below."}
          </p>

          {/* Restricted Permissions */}
          {preset === "restricted" && (
            <div className="flex flex-col divide-y  rounded-sm max-h-[40vh] overflow-y-auto">
              {scopeByResources.map((resource) => (
                <div
                  key={resource.key}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-3 py-4"
                >
                  <span className="text-sm font-medium font-display text-neutral-600">
                    {resource.name}
                  </span>

                  <RadioGroup
                    value={scopes[resource.key] ?? ""}
                    className="flex flex-wrap gap-4"
                    onValueChange={(v: string) => {
                      const updated = { ...data.scopes };

                      if (v === "") {
                        delete updated[resource.key];
                      } else {
                        updated[resource.key] = v as Scope;
                      }

                      setData({ ...data, scopes: updated });
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="" />
                      <span className="text-sm font-display text-neutral-700">
                        None
                      </span>
                    </div>

                    {resource.scopes.map((scope) => (
                      <div key={scope} className="flex items-center space-x-2">
                        <RadioGroupItem value={scope} />
                        <span className="text-sm font-display text-neutral-700 capitalize">
                          {scope.split(".").pop()}
                        </span>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
            </div>
          )}

          {/* Button */}
          <Button
            className="w-full font-display text-white h-9 md:h-10"
            text={token ? "Save Changes" : "Create API Key"}
            loading={saving}
          />
        </form>
      </Modal>
    </>
  );
}

export function useAddEditTokenModal({
  token,
  onTokenCreated,
  setSelectedToken,
}: {
  token?: APIKeyProps;
  onTokenCreated?: (token: string) => void;
  setSelectedToken?: (value: undefined) => void;
}) {
  const [showAddEditTokenModal, setShowAddEditTokenModal] = useState(false);
  const AddEditTokenModalCallback = useCallback(() => {
    return (
      <AddEditTokenModal
        showAddEditTokenModal={showAddEditTokenModal}
        setShowAddEditTokenModal={setShowAddEditTokenModal}
        token={token}
        onTokenCreated={onTokenCreated}
        setSelectedToken={setSelectedToken}
      />
    );
  }, [showAddEditTokenModal, setShowAddEditTokenModal]);

  return useMemo(
    () => ({
      setShowAddEditTokenModal,
      AddEditTokenModal: AddEditTokenModalCallback,
    }),
    [AddEditTokenModalCallback, setShowAddEditTokenModal]
  );
}

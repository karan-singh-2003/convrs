"use client";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useState,
  useMemo,
} from "react";
import {
  getScopesByResourceForRole,
  Scope,
  scopePresets,
} from "@/lib/api/tokens/scopes";
import { Input, Modal, ToggleGroup } from "@repo/ui";
import { Label, Button, RadioGroup, RadioGroupItem } from "@repo/ui";
import useWorkspace from "@/lib/swr/use-workspace";
import { cn } from "@repo/utils";
import { ResourceKey } from "@/lib/api/rbac/resources";
import { RESOURCES } from "@/lib/api/rbac/resources";
import { toast } from "sonner";
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

const transformScopesForUI = (scopedResources) => {
  return Object.keys(scopedResources).map((resourceKey: ResourceKey) => {
    return {
      ...RESOURCES.find((r) => r.key === resourceKey)!,
      scopes: scopedResources[resourceKey],
    };
  });
};

function AddEditTokenModal({
  showAddEditTokenModal,
  setShowAddEditTokenModal,
  token,
}: {
  showAddEditTokenModal: boolean;
  setShowAddEditTokenModal: Dispatch<SetStateAction<boolean>>;
  token?: APIKeyProps;
}) {
  const [data, setData] = useState<APIKeyProps>(token || newToken);
  const { isOwner, role, id: workspaceId } = useWorkspace();
  const [preset, setPreset] = useState<ScopePreset>("all_access");
  const [saving, setSaving] = useState(false);

  const { name, scopes } = data;
  const scopesByResources = transformScopesForUI(
    getScopesByResourceForRole(role)
  ).filter(({ name }) => name);

  console.log("preset", preset);
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

    if (response.ok) {
      toast.success(endpoint.successMessage);
    }
    setSaving(false);
  };
  return (
    <>
      <Modal
        showModal={showAddEditTokenModal}
        setShowModal={setShowAddEditTokenModal}
      >
        <h3 className="border-b border-neutral-200 px-4 py-4 text-lg font-medium sm:px-6">
          {token ? "Edit" : "Create New"} API Key
        </h3>
        <form onSubmit={onsubmit} className="px-3 py-2 flex flex-col gap-4">
          <div className="space-y-2">
            <Label>
              <h2 className="text-sm font-medium text-neutral-900">Name</h2>
            </Label>
            <div>
              <Input
                id="name"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                required
                autoFocus
                autoComplete="off"
              />
            </div>
          </div>

          {!token && (
            <div className="">
              <h2 className="text-sm font-medium text-neutral-900">Type</h2>
              <RadioGroup
                className="mt-2 flex items-center gap-2"
                defaultValue="user"
                required
                onValueChange={(value) => {
                  setData({ ...data, isMachine: value === "machine" });
                }}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="user" id="user">
                    User
                  </RadioGroupItem>
                  <Label
                    htmlFor="user"
                    className="flex flex-1 cursor-pointer items-center  space-x-1 p-3 pl-0"
                  >
                    {" "}
                    <p className="text-neutral-600">You</p>
                  </Label>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-2",
                    !isOwner && "pointer-events-none opacity-50"
                  )}
                >
                  <RadioGroupItem
                    value="machine"
                    id="machine"
                    disabled={!isOwner}
                  >
                    Machine
                  </RadioGroupItem>
                  <Label
                    htmlFor="machine"
                    className={cn(
                      "flex flex-1 cursor-pointer items-center  space-x-1 p-3 pl-0",
                      !isOwner && "pointer-events-none opacity-50"
                    )}
                  >
                    {" "}
                    <p className="text-neutral-600">Machine</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label className=" font-medium text-neutral-900">Permissions</Label>
            <ToggleGroup
              options={scopePresets}
              selected={preset}
              className="grid grid-cols-3 "
              optionClassName="w-full h-8 flex items-center justify-center text-sm "
              indicatorClassName="bg-gray-100"
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

          <div className="text-[13px] font-default">
            This API key will have{" "}
            <span className="font-medium text-neutral-700">
              {scopePresets.find((p) => p.value === preset)?.description}
            </span>
          </div>
          {preset === "restricted" && (
            <div className="flex flex-col divide-y text-sm">
              {scopesByResources.map((resource) => (
                <div
                  className="flex items-center justify-between py-4"
                  key={resource.key}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-neutral-800">
                      {resource.name}
                    </span>
                  </div>
                  <div>
                    <RadioGroup
                      defaultValue={scopes[resource.key] || ""}
                      className="flex gap-4"
                      onValueChange={(v: Scope) => {
                        setData({
                          ...data,
                          scopes: {
                            [resource.key]: v,
                          },
                        });
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="" />
                        <div>None</div>
                      </div>
                      {resource.scopes.map((scope) => (
                        <div
                          className="flex items-center space-x-2"
                          key={scope.scope}
                        >
                          <RadioGroupItem value={scope.scope} />
                          <div className="text-sm font-normal capitalize text-neutral-800">
                            {scope.type}
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button
            className="text-white font-default"
            text="Create API Key"
          ></Button>
        </form>
      </Modal>
    </>
  );
}

export function useAddEditTokenModal({ token }: { token?: APIKeyProps }) {
  const [showAddEditTokenModal, setShowAddEditTokenModal] = useState(false);
  const AddEditTokenModalCallback = useCallback(() => {
    return (
      <AddEditTokenModal
        showAddEditTokenModal={showAddEditTokenModal}
        setShowAddEditTokenModal={setShowAddEditTokenModal}
        token={token}
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

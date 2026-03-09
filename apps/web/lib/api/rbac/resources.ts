export const RESOURCE_KEYS = ["workspace", "webhooks"] as const;

export type ResourceKey = (typeof RESOURCE_KEYS)[number];

export const RESOURCES: {
  name: string;
  key: ResourceKey;
}[] = [
  {
    name: "Workspaces",
    key: "workspace",
  },
];



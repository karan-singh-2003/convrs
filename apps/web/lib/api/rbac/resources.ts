export const RESOURCE_KEYS = [
  "workspace",
  "webhooks",
  "websites",
  "analytics",
  "goals",
  "payments",
] as const;

export type ResourceKey = (typeof RESOURCE_KEYS)[number];

export const RESOURCES: {
  name: string;
  key: ResourceKey;
}[] = [
  {
    name: "Workspaces",
    key: "workspace",
  },
  {
    name: "Websites",
    key: "websites",
  },
  {
    name: "Analytics",
    key: "analytics",
  },
  {
    name: "Goals",
    key: "goals",
  },
  {
    name: "Payments",
    key: "payments",
  },
];



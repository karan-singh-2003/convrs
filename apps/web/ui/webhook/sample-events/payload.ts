import { WebhookTrigger } from "@/lib/types";
import workspaceCreatedPayload from "./workspace-created.json";
import workspaceDeletedPayload from "./workspace-deleted.json";
import workspaceUpdatedPayload from "./workspace-updated.json";
export const samplePayLoad: Record<WebhookTrigger, any> = {
  "workspace.created": workspaceCreatedPayload,
  "workspace.deleted": workspaceDeletedPayload,
  "workspace.updated": workspaceUpdatedPayload,
};

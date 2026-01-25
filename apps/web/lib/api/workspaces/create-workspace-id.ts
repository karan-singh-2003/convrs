import { createId } from "../create-ids"

export const createWorkspaceId = () => {
  const workspaceId = createId({ prefix: "ws_" })
  return workspaceId
}
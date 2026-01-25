import * as z from "zod";
import { WorkspaceRole } from "@repo/db/client";

export const inviteTeammatesSchema = z.object({
  teammates: z.array(
    z.object({
      email: z.email("Invalid email address"),
      role: z.enum(WorkspaceRole),
    })
  ),
});

export type Invites = z.infer<
  typeof inviteTeammatesSchema
>["teammates"][number];

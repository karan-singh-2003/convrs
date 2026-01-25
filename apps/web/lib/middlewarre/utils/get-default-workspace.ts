import { UserProps } from "@/lib/types";
import { prismaEdge } from "@repo/db/edge";

export async function getDefaultWorkspace(user: UserProps) {
  let defaultWorkspace = user?.defaultWorkspace;

  if (!defaultWorkspace) {
    const refreshedUser = await prismaEdge.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        defaultWorkspace: true,
        workspaceUsers:{
          select:{
            workspace:{
              select:{
                slug:true
              }
            }
          }
        }
      },
    });

    defaultWorkspace =
      refreshedUser?.defaultWorkspace ||
      refreshedUser?.workspaceUsers[0]?.workspace?.slug ||
      undefined;
  }

  return defaultWorkspace;
}
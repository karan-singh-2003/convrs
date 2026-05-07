'use server'
import { prisma } from "@repo/db";
import { UserProps } from "../types";

export async function getDefaultWorkspace(user: UserProps) {
  let defaultWorkspace = user?.defaultWorkspaceId;
  if (!defaultWorkspace) {
    const refreshUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        defaultWorkspaceId: true,
        workspaceUsers: {
          select: {
            workspace: {
              select: {
                slug: true,
              },
            },
          },
        },
      },
    });

    defaultWorkspace =
      refreshUser?.defaultWorkspaceId ||
      refreshUser?.workspaceUsers[0]?.workspace?.slug ||
      undefined;
  }

  return defaultWorkspace;
}

import { withSession } from "@/lib/auth/session";
import {
  createWorkspaceSchema,
  WorkspaceSchema,
} from "@/lib/zod/schemas/workspaceSchema";
import { prisma } from "@repo/db";
import { checkIfUserExists } from "@/lib/actions/auth/check-if-user-exists";
import { waitUntil } from "@vercel/functions";
import { createWorkspaceId } from "@/lib/api/workspaces/create-workspace-id";
import { nanoid, R2_URL } from "@repo/utils";
import { NextResponse } from "next/server";
import { prefixWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { storage } from "@/lib/storage";
import {Prisma} from "@repo/db/client"

// POST /api/workspaces - create a new workspace
export const POST = withSession(async ({ req, session }) => {
  const { name, slug, logo } = await createWorkspaceSchema.parseAsync(
    await req.json()
  );

  const userExists = await checkIfUserExists(session.user.id);

  if (!userExists) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    let uploadImageUrl: string | undefined;
    const workspaceId = createWorkspaceId();
    const workspace = await prisma.$transaction(
      async (tx) => {
        uploadImageUrl = logo
          ? `${R2_URL}/workspace/${workspaceId}/logo_${nanoid(7)}`
          : undefined;
        return tx.workspace.create({
          data: {
            name,
            slug,
            logo: uploadImageUrl,
            users: {
              create: {
                userId: session.user.id,
                role: "owner",
              },
            },
            inviteCode: nanoid(24),
          },
          include: {
            users: {
              where: {
                userId: session.user.id,
              },
              select: {
                role: true,
              },
            },
          },
        });
      },
      {
        maxWait: 5000,
        timeout: 5000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    waitUntil(
      Promise.allSettled([
        logo &&
          uploadImageUrl &&
          storage.upload({
            key: uploadImageUrl.replace(`${R2_URL}/`, ""),
            body: logo as string,
          }),
      ])
    );

    return NextResponse.json(
      WorkspaceSchema.parse({
        ...workspace,
        id: prefixWorkspaceId(workspaceId),
      })
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

import { withSession } from "@/lib/auth/session";
import {
  createWorkspaceSchema,
  WorkspaceSchema,
} from "@/lib/zod/schemas/workspaces";
import { prisma } from "@repo/db";
import { nanoid } from "@repo/utils";
import { NextResponse } from "next/server";
import { prefixWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { Prisma } from "@repo/db/client";
import { z } from "zod";

// GET /api/workspaces - get all workspaces for the authenticated user
export const GET = withSession(async ({ session }) => {
  const workspaces = await prisma.workspace.findMany({
    where: {
      users: {
        some: {
          userId: session.user.id,
        },
      },
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
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(
    workspaces.map((workspace) =>
      WorkspaceSchema.parse({
        ...workspace,
        id: prefixWorkspaceId(workspace.id),
      })
    )
  );
});

// POST /api/workspaces - create a new workspace
export const POST = withSession(async ({ req, session }) => {
  let name: string;
  let slug: string;
  let domain: string;

  try {
    ({ name, slug, domain } = await createWorkspaceSchema.parseAsync(
      await req.json()
    ));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: error.issues[0]?.message || "Invalid workspace payload",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Invalid request body",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "Asia/Kolkata"

    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        domain,

        // Billing
        subscriptionStatus: "inactive",
        plan: "free",
        billingInterval: "month",

        // Limits
        tierEvents: 0,
        usageLimit: 0,
        //  timezone
        timezone:detectedTimezone,
        // Tokens
        projectToken: nanoid(32),
        inviteCode: nanoid(24),

        // Owner
        users: {
          create: {
            userId: session.user.id,
            role: "owner",
          },
        },
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

    return NextResponse.json(
      WorkspaceSchema.parse({
        ...workspace,
        id: prefixWorkspaceId(workspace.id),
      })
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return new Response(
        JSON.stringify({
          error: "Workspace slug is already taken",
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.error("[workspace/create]", error);

    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});

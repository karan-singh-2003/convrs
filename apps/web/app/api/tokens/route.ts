import { hashToken, withWorkspace } from "@/lib/auth";
import { createTokenSchema, tokenSchema } from "@/lib/zod/schemas/token";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
// import { validateScopesForRole, scopesToName } from "@/lib/api/tokens/scopes";
import { nanoid } from "@repo/utils";
import { Prisma } from "@prisma/client";
import { waitUntil } from "@vercel/functions";
import { sendEmail } from "@repo/email";
import APIKeyCreated from "@repo/email/templates/api-key-created";
import { scopesToName } from "@/lib/api/tokens/scopes";

const getTokenQuerySchema = z.object({
  userId: z.string().optional(),
});

const MAX_TOKENS_PER_WORKSPACE = 100;

// GET /api/tokens get all tokens for a workspace
export const GET = withWorkspace(
  async ({ workspace, searchParams }) => {
    const { userId } = getTokenQuerySchema.parse(searchParams);
    const token = await prisma.restrictedToken.findMany({
      where: {
        workspaceId: workspace.id,
        ...(userId ? { userId } : {}),
      },
      select: {
        id: true,
        name: true,
        partialKey: true,
        scopes: true,
        lastUsed: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: [
        {
          lastUsed: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 100,
    });
    return NextResponse.json(tokenSchema.array().parse(token));
  },
  {
    requiredPermission: "tokens.read",
  }
);

// POST /api/tokens create a new token for the workspace
export const POST = withWorkspace(
  async ({ req, workspace, session }) => {
    const { name, scopes } = await createTokenSchema.parseAsync(
      await req.json()
    );

    const role = workspace.users[0].role;
    console.log("role", role, "scopes", scopes);

    // if (!validateScopesForRole(role, scopes || [])) {
    //   throw new Error("Invalid scopes for the user's role");
    // }

    // create the token
    const token = `bc_${nanoid(24)}`;
    const hashedKey = await hashToken(token);
    const partialKey = `${token.slice(0, 10)}...${token.slice(-4)}`;

    await prisma.$transaction(
      async (tx) => {
        const totalToken = await tx.restrictedToken.count({
          where: {
            workspaceId: workspace.id,
          },
        });

        if (totalToken >= MAX_TOKENS_PER_WORKSPACE) {
          throw new Error("Token limit reached for this workspace");
        }

        return await tx.restrictedToken.create({
          data: {
            name,
            hashedKey,
            partialKey,
            scopes:
              scopes && scopes?.length > 0
                ? [...new Set(scopes)].join(" ")
                : null,
            workspaceId: workspace.id,
            userId: session.user.id,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadUncommitted,
        maxWait: 5000,
        timeout: 5000,
      }
    );

    waitUntil(
      (async () => {
        try {
          await sendEmail({
            to: session.user.email!,
            subject: "New API Token Created",
            react: APIKeyCreated({
              email: session.user.email,
              token: {
                name,
                type: scopesToName(scopes || []).name,
                permissions: scopesToName(scopes || []).description,
              },
              workspace: {
                name: workspace.name,
                slug: workspace.slug,
              },
            }),
          });
        } catch (error) {
          console.error("Failed to send email notification:", error);
        }
      })()
    );
    return NextResponse.json({ token });
  },
  {
    requiredPermission: "tokens.write",
  }
);

// FILE: app/api/[slug]/social/keywords/route.ts
import { withWorkspace } from "@/lib/auth";
import { prisma } from "@repo/db";
import { z } from "zod";

const createKeywordSchema = z.object({
  term: z.string().min(4).max(15),
});

export const GET = withWorkspace(
  async ({ workspace }) => {
    const keywords = await prisma.socialKeyword.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    });

    return new Response(JSON.stringify({ data: keywords }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
  { requiredPermission: "analytics.read" }
);

export const POST = withWorkspace(
  async ({ req, workspace }) => {
    const body = await req.json();
    const { term } = createKeywordSchema.parse(body);

    const matchType = term.startsWith("@")
      ? "handle"
      : term.startsWith("#")
        ? "hashtag"
        : "broad";

    const keyword = await prisma.socialKeyword.create({
      data: {
        workspaceId: workspace.id,
        term,
        matchType,
        platforms: ["x", "reddit"],
      },
    });

    return new Response(JSON.stringify({ data: keyword }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  },
  { requiredPermission: "workspace:write" }
);
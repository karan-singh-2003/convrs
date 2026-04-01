import { prisma } from "@repo/db";
import { DEFAULT_REDIRECTS, RESERVED_SLUGS } from "@repo/utils";
import { NextRequest, NextResponse } from "next/server";

// GET /api/workspaces/check-workspace-slug?slug=<slug>
export const GET = async (req: NextRequest) => {
  const slug = req.nextUrl.searchParams.get("slug")?.trim().toLowerCase();

  if (!slug) {
    return NextResponse.json(
      { error: "Slug parameter is required" },
      { status: 400 }
    );
  }

  if (RESERVED_SLUGS.includes(slug) || DEFAULT_REDIRECTS[slug]) {
    return NextResponse.json(1);
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { slug: true },
  });

  return NextResponse.json(workspace ? 1 : 0);
};

import { prisma } from "@repo/db";
import { DEFAULT_REDIRECTS, RESERVED_SLUGS } from "@repo/utils";
import { NextResponse } from "next/server";

// GET /api/misc/check-workspace-slug – check if a workspace slug is available
export const GET = (async ({ searchParams }) => {
  const { slug } = searchParams;

  if (!slug) {
    return NextResponse.json(
      { error: "Slug parameter is required" },
      { status: 400 },
    );
  }

  if (RESERVED_SLUGS.includes(slug) || DEFAULT_REDIRECTS[slug]) {
    return NextResponse.json(1);
  }
  const workspace = await prisma.workspace.findUnique({
    where: {
      slug,
    },
    select: {
      slug: true,
    },
  });
  if (workspace) {
    return NextResponse.json(1);
  } else {
    return NextResponse.json(0);
  }
});
// app/api/workspaces/[workspaceId]/import/plausible/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import {
  parsePlausibleZip,
  loadEventsIntoTinybird,
  deletePlausibleImport,
} from "@repo/analytics";

// Route handlers run as serverless functions by default — this work can take
// a while for large exports (parsing + batched Tinybird uploads), so give it
// more room than the default timeout where your platform allows it.
export const runtime = "nodejs";
export const maxDuration = 300; // seconds — adjust to your plan's ceiling

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ idOrSlug: string }> }
) {
  try {
    const { idOrSlug } = await params;

    if (!idOrSlug) {
      return NextResponse.json(
        { success: false, error: "Missing workspace identifier" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(
        {
          success: false,
          error: "Only .zip exports from Plausible are supported",
        },
        { status: 400 }
      );
    }

    const MAX_SIZE = 50 * 1024 * 1024; // 50MB

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "File exceeds the 50MB limit" },
        { status: 413 }
      );
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug },
        ],
      },
      select: {
        id: true,
        slug: true,
        domain: true,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: "Workspace not found" },
        { status: 404 }
      );
    }

    if (!workspace.domain) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Workspace has no domain configured to attribute imported data to",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { events, filesParsed, filesSkipped, rowCount } =
      parsePlausibleZip(buffer, {
        workspaceId: workspace.id,
        hostname: workspace.domain,
      });

    if (rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No recognizable Plausible export files found in this zip",
          filesSkipped,
        },
        { status: 422 }
      );
    }

    const { batches, rows } = await loadEventsIntoTinybird({
      events,
    });

    return NextResponse.json({
      success: true,
      filesParsed,
      filesSkipped,
      rowsImported: rows,
      batches,
    });
  } catch (error) {
    console.error("[Plausible Import] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Optional: let users undo an import (e.g. wrong file, or before they
// realize it double-counts against existing data).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ idOrSlug: string }> }
) {
  try {
    const { idOrSlug } = await params;

    if (!idOrSlug) {
      return NextResponse.json(
        { success: false, error: "Missing workspace identifier" },
        { status: 400 }
      );
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: "Workspace not found" },
        { status: 404 }
      );
    }

    await deletePlausibleImport({
      workspaceId: workspace.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Plausible Import Delete] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
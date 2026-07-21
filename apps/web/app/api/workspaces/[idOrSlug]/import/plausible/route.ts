// app/api/workspaces/[idOrSlug]/import/plausible/route.ts
import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
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

// POST /api/workspaces/[idOrSlug]/import/plausible – import a Plausible zip export
export const POST = withWorkspace(
  async ({ req, workspace }) => {
    // Your schema keeps a single `domain` field directly on Workspace
    // (there's no separate Domain model) — that's what imported traffic
    // gets attributed to.
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

    // NOTE: on platforms with a request body size cap (e.g. Vercel serverless
    // functions cap at 4.5MB), a large Plausible export will not reach this
    // handler at all — the request will be rejected before it gets here. If
    // your exports can exceed that, upload the zip to object storage from
    // the client first and pass a URL/key in the JSON body instead of the
    // raw file, then fetch it here.
    const formData = await req.formData();
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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { events, filesParsed, filesSkipped, rowCount } = parsePlausibleZip(
      buffer,
      { workspaceId: workspace.id, hostname: workspace.domain }
    );

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

    const { batches, rows } = await loadEventsIntoTinybird({ events });

    return NextResponse.json({
      success: true,
      filesParsed,
      filesSkipped,
      rowsImported: rows,
      batches,
    });
  },
  { requiredPermission: "workspace:write" }
);

// DELETE /api/workspaces/[idOrSlug]/import/plausible – undo a Plausible import
// (e.g. wrong file, or before realizing it double-counts against existing data)
export const DELETE = withWorkspace(
  async ({ workspace }) => {
    await deletePlausibleImport({ workspaceId: workspace.id });
    return NextResponse.json({ success: true });
  },
  { requiredPermission: "workspace:write" }
);
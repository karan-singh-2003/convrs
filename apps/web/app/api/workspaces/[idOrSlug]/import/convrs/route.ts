// app/api/workspaces/[idOrSlug]/import/convrs/route.ts
import { withWorkspace } from "@/lib/auth";
import { loadEventsIntoTinybird, parseRawConvrsExport } from "@repo/analytics";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SIZE = 200 * 1024 * 1024; // raw exports can be larger than aggregate-only Plausible zips

export const POST = withWorkspace(
  async ({ req, workspace }) => {
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
          error: "Only .zip exports from Convrs are supported here",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "File exceeds the 200MB limit" },
        { status: 413 }
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const { events, rowCount } = parseRawConvrsExport(buffer, {
      workspaceId: workspace.id,
      hostname: workspace.domain,
    });

    if (rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "No events found in raw_events.csv" },
        { status: 422 }
      );
    }

    const { batches, rows } = await loadEventsIntoTinybird({ events });

    return NextResponse.json({
      success: true,
      rowsImported: rows,
      batches,
    });
  },
  { requiredPermission: "workspace:write" }
);
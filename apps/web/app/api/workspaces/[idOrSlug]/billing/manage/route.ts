import { withWorkspace } from "@/lib/auth";
import { dodo } from "@/lib/dodo";
import { APP_DOMAIN } from "@repo/utils";
import { NextResponse } from "next/server";

export const POST = withWorkspace(
  async ({ workspace }) => {
    if (!workspace.dodoCustomerId) {
      return NextResponse.json(
        { error: "No Dodo customer found" },
        { status: 400 }
      );
    }

    try {
      const session = await dodo.customers.customerPortal.create(
        workspace.dodoCustomerId
      );

      return NextResponse.json({ url: session.link });
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to create billing portal session" },
        { status: 500 }
      );
    }
  },
  { requiredPermission: "billing:write" }
);
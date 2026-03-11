import { withSession } from "@/lib/auth/session";
import {
  listUserPasskeys,
  removeUserPasskey,
  startServerPasskeyRegistration,
  finishServerPasskeyRegistration,
} from "@/lib/api/auth/passkey";
import { NextResponse } from "next/server";

// GET /api/account/passkey - List user's passkeys
export const GET = withSession(async ({ session }) => {
  try {
    const passkeys = await listUserPasskeys({ session });
    return NextResponse.json({ passkeys });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch passkeys" },
      { status: 500 }
    );
  }
});

// POST /api/account/passkey - Register a new passkey (start or finish)
export const POST = withSession(async ({ req, session }) => {
  try {
    const body = await req.json().catch(() => ({}));

    // If credential is provided, finish registration
    if (body.credential) {
  
      await finishServerPasskeyRegistration({
        credential: body.credential,
        session,
      });
      return NextResponse.json({ success: true });
    }


    const createOptions = await startServerPasskeyRegistration({ session });
  
    return NextResponse.json(createOptions);
  } catch (error) {
    
    return NextResponse.json(
      {
        error: "Failed to register passkey",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});

// DELETE /api/account/passkey - Remove a passkey
export const DELETE = withSession(async ({ req, session }) => {
  try {
    const { credentialId } = (await req.json()) as { credentialId: string };

    if (!credentialId) {
      return NextResponse.json(
        { error: "Credential ID is required" },
        { status: 400 }
      );
    }

    await removeUserPasskey({ credentialId, session });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to remove passkey" },
      { status: 500 }
    );
  }
});

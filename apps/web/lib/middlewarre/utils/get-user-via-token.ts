import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { UserProps } from "@/lib/types";

export async function getUserViaToken(req: NextRequest) {
    const session = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as {
        email?: string;
        user?: UserProps
    };

    return session?.user;
}
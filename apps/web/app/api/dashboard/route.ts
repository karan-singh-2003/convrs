import { authOptions } from "@/lib/auth/options";
import { tb } from "@/lib/tinybird";
import { getServerSession } from "next-auth";
import * as z from "zod/v4";

const dashboardPipe = tb.buildPipe({
    pipe: "v1_dashboard_pipe",
    parameters: z.object({
        user_id: z.string(),
    }),
    data: z.object({
        visitors: z.number(),
        revenue: z.number(),
    }),
});

export async function GET(req: Request) {

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const response = await dashboardPipe({
        user_id: session.user.id,
    });

    return Response.json(response.data[0]);
}
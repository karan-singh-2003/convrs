import { getSession, Session } from "./utils";
import { getSearchParams } from "@repo/utils";

interface WithSessionHandle {
  ({
    req,
    session,
    params,
    searchParams,
  }: {
    req: Request;
    session: Session;
    params: Record<string, string>;
    searchParams: Record<string, string>;
  }): Promise<Response>;
}

export const withSession =
  (handler: WithSessionHandle) =>
  async (
    req: Request,
    { params: initialParams }: { params: Promise<Record<string, string>> }
  ) => {
    const params = (await initialParams) || {};
    const responseHeaders = new Headers();

    try {
      const session = await getSession();
      if (!session.user.id) {
        throw new Error("No session");
      }

      const searchParams = getSearchParams(req.url);
      return await handler({
        req,
        session,
        params,
        searchParams,
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  };

// import { getSession, Session } from "./utils";
// import { getSearchParams } from "@repo/utils";

// interface WithSessionHandle {
//   ({
//     req,
//     session,
//     params,
//     searchParams,
//   }: {
//     req: Request;
//     session: Session;
//     params: Record<string, string>;
//     searchParams: Record<string, string>;
//   }): Promise<Response>;
// }

// export const withSession =
//   (handler: WithSessionHandle) =>
//     async (
//       req: Request,
//       { params: initialParams }: { params?: Promise<Record<string, string>> }
//     ) => {
//       const params = (await initialParams) ?? ({} as Record<string, string>);
//       const responseHeaders = new Headers();

//       try {
//         const session = await getSession();
//         if (!session.user.id) {
//           throw new Error("No session");
//         }

//         const searchParams = getSearchParams(req.url);
//         return await handler({
//           req,
//           session,
//           params,
//           searchParams,
//         });
//       } catch (error) {
//         return new Response(JSON.stringify({ error: "Unauthorized" }), {
//           status: 401,
//           headers: { "Content-Type": "application/json" },
//         });
//       }
//     };


import { getSession, Session } from "./utils";
import { getSearchParams } from "@repo/utils";

interface WithSessionHandle<TParams extends Record<string, string> = Record<string, string>> {
  ({
    req,
    session,
    params,
    searchParams,
  }: {
    req: Request;
    session: Session;
    params: TParams;
    searchParams: Record<string, string>;
  }): Promise<Response>;
}

export const withSession =
  <TParams extends Record<string, string> = Record<string, string>>(
    handler: WithSessionHandle<TParams>
  ) =>
    async (
      req: Request,
      context?: { params?: Promise<any> }
    ) => {
      const params = ((await context?.params) ?? {}) as TParams;

      try {
        const session = await getSession();
        if (!session.user.id) {
          throw new Error("No session");
        }

        // 👇 explicitly type the generic (or cast) so it's not inferred as {}
        const searchParams = getSearchParams(req.url) as Record<string, string>;

        return await handler({
          req,
          session,
          params,
          searchParams,
        });
      } catch (error) {
        console.error("[withSession] auth failed:", error);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    };
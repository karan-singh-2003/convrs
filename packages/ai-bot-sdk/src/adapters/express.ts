import { decideWhetherToTrack } from "../decide";
import { sendBotEvent } from "../send";
import { normalizeStatusCode } from "../request-utils";
import type { ConvrsBotConfig, MinimalRequest } from "../types";

/** Minimal shape of Node's IncomingMessage that we actually rely on. */
export interface NodeStyleRequest {
  method?: string;
  url?: string;
  originalUrl?: string;
  protocol?: string;
  /** Set by Express from its own `trust proxy` configuration. */
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  // `remoteAddress` is listed (though unused) so a plain net.Socket shares a
  // property with this all-optional type; otherwise TypeScript's weak-type
  // check rejects Express's `req` and `app.use(middleware)` fails to compile.
  socket?: { encrypted?: boolean; remoteAddress?: string };
}

export interface NodeStyleResponse {
  statusCode?: number;
  once?: (event: "finish", listener: () => void) => void;
}

export function createExpressBotMiddleware(config: ConvrsBotConfig) {
  return function convrsExpressMiddleware(
    req: NodeStyleRequest,
    res: NodeStyleResponse,
    next: () => void
  ) {
    try {
      const request = toMinimalRequest(req);
      const decision = decideWhetherToTrack(request, config);

      if (decision.shouldTrack) {
        const flush = () => {
          void sendBotEvent(request, config, decision, {
            statusCode: normalizeStatusCode(res?.statusCode),
          });
        };
        if (typeof res?.once === "function") {
          res.once("finish", flush);
        } else {
          flush();
        }
      }
    } catch (err) {
      if (config.debug) {
        // eslint-disable-next-line no-console
        console.warn("[convrs] express middleware failed to schedule tracking", err);
      }
    } finally {
      next();
    }
  };
}

function toMinimalRequest(req: NodeStyleRequest): MinimalRequest {
  const protocol = req.protocol ?? headerValue(req, "x-forwarded-proto") ?? (req.socket?.encrypted ? "https" : "http");
  const host = headerValue(req, "host") ?? "localhost";
  const path = req.originalUrl ?? req.url ?? "/";
  const href = /^https?:\/\//i.test(path) ? path : `${protocol}://${host}${path}`;

  const headerMap = new Map<string, string>();
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (Array.isArray(value)) {
      headerMap.set(key.toLowerCase(), value.join(", "));
    } else if (typeof value === "string") {
      headerMap.set(key.toLowerCase(), value);
    }
  }

  return {
    url: href,
    method: req.method ?? "GET",
    headers: {
      get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
    },
    ip: req.ip ?? null,
  };
}

function headerValue(req: NodeStyleRequest, name: string): string | undefined {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

/** `app.use(createExpressAICrawlerMiddleware({ websiteId }))` — same as createExpressBotMiddleware. */
export const createExpressAICrawlerMiddleware = createExpressBotMiddleware;

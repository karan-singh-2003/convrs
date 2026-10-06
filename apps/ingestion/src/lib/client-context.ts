import { timingSafeEqual } from "node:crypto";
import net from "node:net";

/**
 * Trusted client IP + geo for an inbound tracking request.
 *
 * Header policy (highest precedence first). Nothing else is ever read:
 * `x-debug-ip`, a raw `x-forwarded-for`, or a client-sent `x-vercel-*`
 * header are all trivially forgeable by anyone POSTing to ingest directly.
 *
 *  1. Signed forward from apps/web's `/api/track` proxy: the request carries
 *     `x-convrs-forward-secret` equal to `INGEST_FORWARD_SECRET`. Only then
 *     are `x-convrs-client-ip` / `x-convrs-geo-*` trusted — the web proxy
 *     fills them from the headers Vercel's edge overwrites.
 *  2. `CLIENT_IP_HEADER` — one header the infrastructure directly in front
 *     of this service overwrites. Defaults to `cf-connecting-ip` on Render
 *     (`RENDER=true`), whose edge is Cloudflare. When that header is
 *     `cf-connecting-ip`, Cloudflare's `cf-ipcountry` is trusted for geo.
 *  3. Express `req.ip`, which honours `app.set("trust proxy", TRUST_PROXY)`.
 *
 * In (1) and (2) a missing header yields `null`, never a fallback to a less
 * trusted source.
 */

export interface ClientContextRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

export interface TrustedGeo {
  country: string | null;
  region: string | null;
  city: string | null;
  continent: string | null;
  latitude: string | null;
  longitude: string | null;
}

export interface ClientContext {
  ip: string | null;
  geo: TrustedGeo;
  source: "signed-forward" | "edge-header" | "socket";
}

type Env = Record<string, string | undefined>;

const EMPTY_GEO: TrustedGeo = {
  country: null,
  region: null,
  city: null,
  continent: null,
  latitude: null,
  longitude: null,
};

function header(req: ClientContextRequest, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : null;
}

/** A syntactically valid IPv4/IPv6 address, normalized, or null. */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.split(",")[0]!.trim();
  if (value.startsWith("[")) value = value.slice(1, value.indexOf("]"));
  if (value.toLowerCase().startsWith("::ffff:") && net.isIPv4(value.slice(7))) {
    value = value.slice(7);
  }
  if (net.isIP(value)) return value;
  // IPv4 with a port ("203.0.113.9:443")
  const hostPart = value.replace(/:\d+$/, "");
  return net.isIPv4(hostPart) ? hostPart : null;
}

function cleanCountry(value: string | null): string | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  // XX = unknown, T1 = Tor (Cloudflare); neither is a country.
  if (!/^[A-Z]{2}$/.test(upper) || upper === "XX" || upper === "T1") return null;
  return upper;
}

function decode(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanCoordinate(value: string | null): string | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= 180 ? String(n) : null;
}

export function hasValidForwardSecret(req: ClientContextRequest, env: Env = process.env): boolean {
  const expected = env.INGEST_FORWARD_SECRET;
  const provided = header(req, "x-convrs-forward-secret");
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Startup diagnostic: in production, apps/web's /api/track proxy can only
 * pass the visitor IP/geo when both sides share INGEST_FORWARD_SECRET.
 * Without it, forwarded events fall back to the edge header, which is the
 * proxy's own IP. Returns the error to log, or null. Never includes the secret.
 * Render is treated as production because it does not set NODE_ENV itself.
 */
export function missingForwardSecretError(env: Env = process.env): string | null {
  const production = env.NODE_ENV === "production" || env.RENDER === "true";
  if (!production || env.INGEST_FORWARD_SECRET?.trim()) return null;
  return (
    "[ingestion] INGEST_FORWARD_SECRET is not set in production. Signed visitor IP/geo from apps/web's " +
    "/api/track proxy cannot be verified, so tracked events get the proxy's IP and location and " +
    "cookieless visitors collapse. Set the same INGEST_FORWARD_SECRET on ingestion and apps/web."
  );
}

export function resolveClientIpHeader(env: Env = process.env): string | null {
  const configured = env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (configured) return configured === "none" ? null : configured;
  if (env.RENDER === "true") return "cf-connecting-ip";
  return null;
}

export function getClientContext(req: ClientContextRequest, env: Env = process.env): ClientContext {
  if (hasValidForwardSecret(req, env)) {
    return {
      ip: normalizeIp(header(req, "x-convrs-client-ip")),
      geo: {
        country: cleanCountry(header(req, "x-convrs-geo-country")),
        region: decode(header(req, "x-convrs-geo-region")),
        city: decode(header(req, "x-convrs-geo-city")),
        continent: header(req, "x-convrs-geo-continent"),
        latitude: cleanCoordinate(header(req, "x-convrs-geo-latitude")),
        longitude: cleanCoordinate(header(req, "x-convrs-geo-longitude")),
      },
      source: "signed-forward",
    };
  }

  const ipHeader = resolveClientIpHeader(env);
  if (ipHeader) {
    const isCloudflare = ipHeader === "cf-connecting-ip";
    return {
      ip: normalizeIp(header(req, ipHeader)),
      geo: isCloudflare
        ? {
            ...EMPTY_GEO,
            country: cleanCountry(header(req, "cf-ipcountry")),
            region: header(req, "cf-region-code"),
            city: decode(header(req, "cf-ipcity")),
            continent: header(req, "cf-ipcontinent"),
            latitude: cleanCoordinate(header(req, "cf-iplatitude")),
            longitude: cleanCoordinate(header(req, "cf-iplongitude")),
          }
        : { ...EMPTY_GEO },
      source: "edge-header",
    };
  }

  return {
    ip: normalizeIp(req.ip ?? req.socket?.remoteAddress ?? null),
    geo: { ...EMPTY_GEO },
    source: "socket",
  };
}

/** Value for Express's `trust proxy` setting; `false` unless configured. */
export function resolveTrustProxySetting(env: Env = process.env): boolean | number | string {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw) return false;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

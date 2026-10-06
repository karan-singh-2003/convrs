// import { headers } from "next/headers";

// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Methods": "POST, OPTIONS",
//   "Access-Control-Allow-Headers": "Content-Type, Authorization",
// };

// export async function OPTIONS() {
//   return new Response(null, {
//     status: 204,
//     headers: corsHeaders,
//   });
// }

// export async function POST(req: Request) {
//   const body = await req.text();

//   const h = await headers();

//   const response = await fetch("https://ingest.convrs.dev/api/track", {
//     method: "POST",

//     headers: {
//       "content-type": "application/json",
//       "user-agent": h.get("user-agent") || "",

//       "x-vercel-ip-country": h.get("x-vercel-ip-country") || "",

//       "x-vercel-ip-city": h.get("x-vercel-ip-city") || "",

//       "x-vercel-ip-country-region": h.get("x-vercel-ip-country-region") || "",

//       "x-vercel-ip-continent": h.get("x-vercel-ip-continent") || "",

//       "x-vercel-ip-latitude": h.get("x-vercel-ip-latitude") || "",

//       "x-vercel-ip-longitude": h.get("x-vercel-ip-longitude") || "",

//       "x-forwarded-for": h.get("x-forwarded-for") || "",
//     },

//     body,
//   });

//   return new Response(await response.text(), {
//     status: response.status,
//     headers: corsHeaders,
//   });
// }


import { headers } from "next/headers";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Single source of truth for the ingest target — swap via env, not by
// hand-editing this file when moving between local/prod.
const INGEST_URL = process.env.INGEST_API_URL ?? "https://ingest.convrs.dev/api/track";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

const MAX_BODY_BYTES = 64 * 1024;

// Vercel geo header → signed header ingestion reads.
const VERCEL_GEO_HEADERS: Record<string, string> = {
  "x-vercel-ip-country": "x-convrs-geo-country",
  "x-vercel-ip-country-region": "x-convrs-geo-region",
  "x-vercel-ip-city": "x-convrs-geo-city",
  "x-vercel-ip-continent": "x-convrs-geo-continent",
  "x-vercel-ip-latitude": "x-convrs-geo-latitude",
  "x-vercel-ip-longitude": "x-convrs-geo-longitude",
};

let missingSecretLogged = false;

/**
 * Headers for the hop to ingestion. Ingestion trusts the visitor IP/geo
 * below only when `x-convrs-forward-secret` matches its own
 * INGEST_FORWARD_SECRET — anyone can POST to ingest directly with forged
 * x-vercel-* / x-forwarded-for headers. Visitor IP/geo are only read on
 * Vercel, whose edge overwrites these request headers, and only from the
 * named Vercel headers: nothing the client sends is passed through as-is.
 */
function forwardHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = { "content-type": "application/json" };
  for (const name of ["user-agent", "referer", "origin", "accept-language"]) {
    const value = h.get(name);
    if (value) out[name] = value;
  }

  if (process.env.VERCEL !== "1") return out;

  const clientIp = (h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0]?.trim();
  const geo: Array<[vercelName: string, value: string]> = [];
  for (const name of Object.keys(VERCEL_GEO_HEADERS)) {
    const value = h.get(name);
    if (value) geo.push([name, value]);
  }

  // Rollout compatibility: the ingestion build before signed forwarding
  // reads the visitor IP from x-forwarded-for and geo from x-vercel-ip-*.
  // Same Vercel-derived values as the signed headers; current ingestion
  // ignores both unless signed. Remove once that ingestion build is live.
  if (clientIp) out["x-forwarded-for"] = clientIp;
  for (const [name, value] of geo) out[name] = value;

  const secret = process.env.INGEST_FORWARD_SECRET;
  if (!secret) {
    if (!missingSecretLogged) {
      missingSecretLogged = true;
      console.error(
        "[track-proxy] INGEST_FORWARD_SECRET is not set on this Vercel deployment. Visitor IP and geo are not " +
          "forwarded to ingestion in signed form, so ingestion will not trust them: events get the proxy's IP " +
          "and location, and cookieless visitors collapse. Set the same INGEST_FORWARD_SECRET here and on ingestion."
      );
    }
    return out;
  }

  out["x-convrs-forward-secret"] = secret;
  if (clientIp) out["x-convrs-client-ip"] = clientIp;
  for (const [name, value] of geo) out[VERCEL_GEO_HEADERS[name]!] = value;
  return out;
}

export async function POST(req: Request) {
  const body = await req.text();
  if (body.length > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ success: false, error: "Payload too large" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const h = await headers();

  try {
    const response = await fetch(INGEST_URL, {
      method: "POST",
      headers: forwardHeaders(h),
      body,
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // NEW — without this, a network failure (ingest down, DNS blip, local
    // dev server not running) throws before any Response is constructed.
    // Next.js then returns its OWN error response, which has none of your
    // corsHeaders on it — the browser reports a confusing "CORS header
    // missing" error that completely hides the real problem (the fetch
    // to INGEST_URL failed). Always return a Response with corsHeaders,
    // even on failure, so the real error is visible in your own logs and
    // the browser console shows the actual HTTP status instead of a CORS
    // red herring.
    console.error("[track-proxy] Failed to reach ingest service:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Ingest service unreachable" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
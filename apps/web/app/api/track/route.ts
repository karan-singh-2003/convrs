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

export async function POST(req: Request) {
  const body = await req.text();
  const h = await headers();

  try {
    const response = await fetch(INGEST_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": h.get("user-agent") || "",
        "x-vercel-ip-country": h.get("x-vercel-ip-country") || "",
        "x-vercel-ip-city": h.get("x-vercel-ip-city") || "",
        "x-vercel-ip-country-region": h.get("x-vercel-ip-country-region") || "",
        "x-vercel-ip-continent": h.get("x-vercel-ip-continent") || "",
        "x-vercel-ip-latitude": h.get("x-vercel-ip-latitude") || "",
        "x-vercel-ip-longitude": h.get("x-vercel-ip-longitude") || "",
        "x-forwarded-for": h.get("x-forwarded-for") || "",
      },
      body,
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: corsHeaders,
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
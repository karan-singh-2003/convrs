import { headers } from "next/headers";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: Request) {
  const body = await req.text();

  const h = await headers();

  const response = await fetch(
    "https://ingest.convrs.dev/api/track",
    {
      method: "POST",

      headers: {
        "content-type": "application/json",

        "x-vercel-ip-country":
          h.get("x-vercel-ip-country") || "",

        "x-vercel-ip-city":
          h.get("x-vercel-ip-city") || "",

        "x-vercel-ip-country-region":
          h.get("x-vercel-ip-country-region") || "",

        "x-vercel-ip-continent":
          h.get("x-vercel-ip-continent") || "",

        "x-vercel-ip-latitude":
          h.get("x-vercel-ip-latitude") || "",

        "x-vercel-ip-longitude":
          h.get("x-vercel-ip-longitude") || "",

        "x-forwarded-for":
          h.get("x-forwarded-for") || "",
      },

      body,
    }
  );

  return new Response(await response.text(), {
    status: response.status,
    headers: corsHeaders,
  });
}
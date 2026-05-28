import { headers } from "next/headers";

export async function POST(req: Request) {
  const body = await req.text();

  const h = headers();

  const response = await fetch(
    "https://ingest.convrs.dev/api/track",
    {
      method: "POST",

      headers: {
        "content-type": "application/json",

        // Forward geo headers
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

        // Forward original IP too
        "x-forwarded-for":
          h.get("x-forwarded-for") || "",
      },

      body,
    }
  );

  return new Response(await response.text(), {
    status: response.status,
  });
}
import { recordClick } from "@/lib/analytics/record-click";
// ============================================================================
// CORS Configuration
// ============================================================================

const ALLOWED_ORIGINS = ["http://localhost:8080"];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const body = await req.json();
    const { visitor_id, website_id, url, timestamp } = body;

    if (!visitor_id || !website_id) {
      return Response.json(
        { success: false, error: "Missing required fields: visitor_id, website_id" },
        { status: 400, headers: corsHeaders }
      );
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const enrichedPayload = {
      ...body,
      server_timestamp: new Date().toISOString(),
      timestamp: timestamp || new Date().toISOString(),
      ip_address: clientIp,
      user_agent: req.headers.get("user-agent") || "unknown",
    };

    const result = await recordClick({ req, payload: enrichedPayload });

    if (!result) {
      return Response.json({ success: true, recorded: false }, { headers: corsHeaders });
    }

    return Response.json(
      { success: true, recorded: true, id: result.click_id },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[Track POST] Error:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}


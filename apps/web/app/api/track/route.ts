import { userAgent } from "next/server";
import { geolocation, ipAddress } from "@vercel/functions";
import { recordClick, type RequestContext, type UserAgentInfo } from "@repo/analytics";

/**
 * Next.js/Vercel Adapter for Analytics
 * Extracts data using Next.js/Vercel APIs and passes normalized context to core function
 */

/**
 * Parse user agent from Next.js request
 */
function parseUserAgent(req: Request): UserAgentInfo {
  const ua = userAgent(req);
  return {
    ua: ua.ua || "",
    isBot: ua.isBot || false,
    browser: {
      name: ua.browser.name,
      version: ua.browser.version,
    },
    device: {
      type: ua.device.type,
      model: ua.device.model,
      vendor: ua.device.vendor,
    },
    os: {
      name: ua.os.name,
      version: ua.os.version,
    },
    engine: {
      name: ua.engine.name,
      version: ua.engine.version,
    },
    cpu: {
      architecture: ua.cpu?.architecture,
    },
  };
}

/**
 * Create a RequestContext from Next.js Request
 */
function createRequestContext(req: Request): RequestContext {
  const ip = ipAddress(req) || "127.0.0.1";
  const isVercel = process.env.VERCEL === "1";

  // Get geo data from Vercel
  const vercelGeo = isVercel ? geolocation(req) : null;
  
  const geo = {
    country: vercelGeo?.country ?? "Localhost",
    city: vercelGeo?.city ?? "Localhost",
    latitude: vercelGeo?.latitude ?? "0",
    longitude: vercelGeo?.longitude ?? "0",
    region: isVercel ? (req.headers.get("x-vercel-ip-country-region") ?? "Localhost") : "Localhost",
    continent: isVercel ? (req.headers.get("x-vercel-ip-continent") ?? "Localhost") : "Localhost",
    vercelRegion: isVercel ? req.headers.get("x-vercel-edge-region") : null,
  };

  return {
    url: req.url,
    method: req.method,
    ip,
    userAgent: parseUserAgent(req),
    geo,
    referer: req.headers.get("referer"),
    headers: {
      get(name: string) {
        return req.headers.get(name);
      },
    },
  };
}

// ============================================================================
// CORS Configuration
// ============================================================================

function getCorsHeaders(origin: string | null): Record<string, string> {
  // Allow any origin for analytics (customers embed on their sites)
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// Handle preflight requests
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
    const { visitor_id, website_id, timestamp } = body;

    if (!visitor_id || !website_id) {
      return Response.json(
        { success: false, error: "Missing required fields: visitor_id, website_id" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Create normalized context from Next.js request
    const context = createRequestContext(req);

    const enrichedPayload = {
      ...body,
      server_timestamp: new Date().toISOString(),
      timestamp: timestamp || new Date().toISOString(),
      ip_address: context.ip,
      user_agent: context.userAgent.ua,
    };

    const result = await recordClick({
      context,
      payload: enrichedPayload,
    });

    if (!result) {
      return Response.json(
        { success: true, recorded: false },
        { headers: corsHeaders }
      );
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

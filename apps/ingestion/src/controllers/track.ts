import { Request, Response } from "express";
import { recordClick } from "@repo/analytics";

export async function trackClickController(req: Request, res: Response) {
  console.log("[Track Controller] Received request");

  try {
    const body = req.body;
    const { visitor_id, website_id, timestamp } = body;

    if (!visitor_id || !website_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: visitor_id, website_id",
      });
    }

    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
      (req.headers["x-real-ip"] as string) ||
      req.ip ||
      "unknown";

    const enrichedPayload = {
      ...body,
      server_timestamp: new Date().toISOString(),
      timestamp: timestamp || new Date().toISOString(),
      ip_address: clientIp,
      user_agent: req.headers["user-agent"] || "unknown",
    };

    // Create a minimal Request-like object for recordClick
    const fakeReq = new globalThis.Request("http://localhost/api/track", {
      method: "POST",
      headers: new Headers({
        "user-agent": (req.headers["user-agent"] as string) || "",
        "x-forwarded-for": clientIp,
        ...(req.headers["referer"] && {
          referer: req.headers["referer"] as string,
        }),
      }),
    });

    const result = await recordClick({
      req: fakeReq,
      payload: enrichedPayload,
    });

    if (!result) {
      return res.json({ success: true, recorded: false });
    }

    return res.json({ success: true, recorded: true, id: result.click_id });
  } catch (error) {
    console.error("[Track POST] Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

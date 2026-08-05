import { Request, Response } from "express";
import { randomUUID, createHash } from "crypto";
import * as z from "zod/v4";
import { classifyBotUserAgent } from "@convrs/ai-bot-sdk";
import { trackBotEvent } from "@repo/analytics";
import { prisma } from "@repo/db";

// ── Incoming payload from @convrs/ai-bot-sdk's sendBotEvent() ────────────────
const IncomingBotEventSchema = z.object({
  siteId: z.string().optional(),
  websiteId: z.string().optional(),
  domain: z.string().optional(),
  url: z.string(),
  referrer: z.string().nullable().optional(),
  bot: z.object({
    userAgent: z.string(),
    ip: z.string().nullable().optional(),
    statusCode: z.number().optional(),
    source: z.string().optional(),
  }),
});

export async function trackAICrawlerController(req: Request, res: Response) {

  try {
    const parsed = IncomingBotEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid bot tracking payload",
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const siteId = payload.siteId ?? payload.websiteId;
    if (!siteId) {
      return res.status(400).json({ success: false, error: "Missing siteId" });
    }

    const classification = classifyBotUserAgent(payload.bot.userAgent);
    if (!classification) {
      return res.status(202).json({ success: true, tracked: false, reason: "not_a_bot" });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { projectToken: siteId },
      select: {
        id: true,
        blockedHostnames: true,
        blockedIpAddresses: true,
        blockedPages: true,
        blockedCountries: true,
        botTrafficRequireAuth: true,
        subscriptionStatus: true,
      },
    });

    if (!workspace) {
      return res.status(404).json({ success: false, error: "Workspace not found" });
    }

    if (workspace.subscriptionStatus === "inactive") {
      return res.status(403).json({ success: false, error: "Subscription inactive" });
    }

    if (workspace.botTrafficRequireAuth) {
      const authHeader = req.headers.authorization ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!token.startsWith("cvbot_") || !(await isValidBotToken(token, workspace.id))) {
        return res.status(401).json({ success: false, error: "Invalid or missing bot tracking token" });
      }
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(payload.url);
    } catch {
      return res.status(400).json({ success: false, error: "Invalid url" });
    }

    const hostname = (payload.domain || parsedUrl.hostname).toLowerCase();
    const page = parsedUrl.pathname.toLowerCase();

    if (
      workspace.blockedHostnames &&
      workspace.blockedHostnames.length > 0 &&
      workspace.blockedHostnames.some((h) => h && hostname === h.toLowerCase())
    ) {
      return res.status(403).json({ success: false, error: "Blocked by hostname filter" });
    }
    if (
      workspace.blockedPages &&
      workspace.blockedPages.length > 0 &&
      workspace.blockedPages.some((p) => p && page.startsWith(p.toLowerCase()))
    ) {
      return res.status(403).json({ success: false, error: "Blocked by page filter" });
    }

    const ip = payload.bot.ip ?? null;

    if (ip && workspace.blockedIpAddresses && workspace.blockedIpAddresses.length > 0) {
      const ipRangeCheck = (await import("ip-range-check")).default;
      if (workspace.blockedIpAddresses.some((blocked: string) => ipRangeCheck(ip, blocked))) {
        return res.status(403).json({ success: false, error: "Blocked by IP filter" });
      }
    }

    const country = await resolveCountryForIp(ip);

    if (
      country &&
      workspace.blockedCountries?.some((c) => c.trim().toUpperCase() === country.toUpperCase())
    ) {
      return res.status(403).json({ success: false, error: "Blocked by country filter" });
    }

    const event = {
      event_id: randomUUID(),
      timestamp: new Date().toISOString().replace("T", " ").replace("Z", ""),
      workspace_id: workspace.id,
      domain: hostname,
      url: parsedUrl.href,
      hostname,
      page,
      vendor: classification.vendor,
      agent_name: classification.agentName,
      category: classification.category,
      user_agent: payload.bot.userAgent,
      ip,
      country: country ?? "Unknown",
      status_code: payload.bot.statusCode ?? null,
      referrer: payload.referrer ?? null,
      source: payload.bot.source ?? "server-sdk",
    };

    await trackBotEvent({ event, logger: console as any });

    return res.status(202).json({ success: true, tracked: true, category: classification.category });
  } catch (error) {
    console.error("[AI Crawl Track] Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function resolveCountryForIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  return null;
}

async function isValidBotToken(token: string, workspaceId: string): Promise<boolean> {
  const hashedKey = createHash("sha256").update(token).digest("hex");
  const restrictedToken = await prisma.restrictedToken.findFirst({
    where: { hashedKey, workspaceId },
    select: { id: true },
  });
  return Boolean(restrictedToken);
}
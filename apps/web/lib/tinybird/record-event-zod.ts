import { userAgent } from "next/server";
import { geolocation, ipAddress, waitUntil } from "@vercel/functions";
import { fetchWithRetry, capitalize } from "@repo/utils";
import { detectBot } from "@/lib/middlewarre/utils/detect-bot";
import { getIdentityHash } from "@/lib/middlewarre/utils/get-identity-hash";
import { getDomainWithoutWWW } from "@repo/utils";

export async function recordClick({
  req,
  clickId,
  workspaceId,
  linkId,
  domain,
  key,
  url,
  programId,
  partnerId,
  webhookIds,
  skipRatelimit,
  timestamp,
  referrer,
  trigger = "link",
  shouldCacheClickId,
}: {
  req: Request;
  clickId?: string;
  linkId: string;
  workspaceId?: string;
  domain: string;
  key: string;
  url?: string;
  programId?: string;
  partnerId?: string;
  webhookIds?: string[];
  skipRatelimit?: boolean;
  timestamp?: string;
  referrer?: string;
  trigger?: string;
  shouldCacheClickId?: boolean;
}) {
  if (!clickId) {
    return null;
  }

  const searchParams = new URL(req.url).searchParams;

  // only track the click when there is no `dub-no-track` header or query param
  if (req.headers.has("dub-no-track") || searchParams.has("dub-no-track")) {
    return null;
  }

  const ua = userAgent(req);
  const isBot = detectBot(req);

  // don't record clicks from bots
  if (isBot) {
    console.log(`Click not recorded ❌ – Bot detected.`, {
      ua,
      isBot,
    });
    return null;
  }

  const identityHash = await getIdentityHash(req);

  // get continent, region & geolocation data
  // interesting, geolocation().region is Vercel's edge region – NOT the actual region
  // so we use the x-vercel-ip-country-region to get the actual region
  const { continent, region } =
    process.env.VERCEL === "1"
      ? {
          continent: req.headers.get("x-vercel-ip-continent"),
          region: req.headers.get("x-vercel-ip-country-region"),
        }
      : { continent: "Localhost", region: "Localhost" };

  const geo =
    process.env.VERCEL === "1" ? geolocation(req) : { country: "Localhost" };

  const ip = process.env.VERCEL === "1" ? ipAddress(req) : "127.0.0.1";

  const referer = referrer || req.headers.get("referer");

  const clickData = {
    timestamp: timestamp || new Date(Date.now()).toISOString(),
    identity_hash: identityHash,
    click_id: clickId,
    workspace_id: workspaceId || "",
    link_id: linkId,
    domain,
    key,
    url: url || "",
    ip:
      // only record IP if it's a valid IP and not from a EU country
      typeof ip === "string" && ip.trim().length > 0 && ip,
    continent: continent || "",
    country: geo.country || "Unknown",
    region: region || "Unknown",
    city: geo.city || "Unknown",
    latitude: geo.latitude || "Unknown",
    longitude: geo.longitude || "Unknown",
    vercel_region: geo.region || "",
    device: capitalize(ua.device.type) || "Desktop",
    device_vendor: ua.device.vendor || "Unknown",
    device_model: ua.device.model || "Unknown",
    browser: ua.browser.name || "Unknown",
    browser_version: ua.browser.version || "Unknown",
    engine: ua.engine.name || "Unknown",
    engine_version: ua.engine.version || "Unknown",
    os: ua.os.name || "Unknown",
    os_version: ua.os.version || "Unknown",
    cpu_architecture: ua.cpu?.architecture || "Unknown",
    ua: ua.ua || "Unknown",
    bot: ua.isBot,
    referer: referer ? getDomainWithoutWWW(referer) || "(direct)" : "(direct)",
    referer_url: referer || "(direct)",
    trigger,
  };

  waitUntil(
    (async () => {
      const response = await Promise.allSettled([
        fetchWithRetry(
          `${process.env.TINYBIRD_API_URL}/v0/events?name=dub_click_events&wait=true`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.TINYBIRD_API_KEY}`,
            },
            body: JSON.stringify(clickData),
          }
        ).then((res) => res.json()),
      ]);

      // Find the rejected promises and log them
      if (response.some((result) => result.status === "rejected")) {
        const errors = response
          .map((result, index) => {
            if (result.status === "rejected") {
              const operations = [
                "Tinybird click event ingestion",
                "recordClickCache set",
                "Link clicks increment",
                "Workspace usage increment",
                "Program enrollment totalClicks increment",
              ];
              return {
                operation: operations[index] || `Operation ${index}`,
                error: result.reason,
                errorString: JSON.stringify(result.reason, null, 2),
              };
            }
            return null;
          })
          .filter((err): err is NonNullable<typeof err> => err !== null);

        console.error("[Record click] - Rejected promises:", {
          totalErrors: errors.length,
          errors: errors.map((err) => ({
            operation: err.operation,
            error: err.error,
            errorString: err.errorString,
          })),
        });
      }
    })()
  );

  return clickData;
}

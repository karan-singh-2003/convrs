import { IP_BOTS, IP_RANGES_BOTS, REFERRER_BOTS, UA_BOTS } from "./bots-list";
import { isIpInRange } from "./is-ip-in-range";
import { parseUserAgent } from "./parse-user-agent";
import { getIpAddress } from "./get-ip-address";

export const detectBot = (req: Request) => {
  const searchParams = new URL(req.url).searchParams;

  if (searchParams.get("bot")) {
    return true;
  }

  // HEAD requests are generally from bots, real users will always use GET requests
  if (req.method === "HEAD") {
    return true;
  }

  // Check ua
  const uaString = req.headers.get("user-agent") || "";
  const ua = parseUserAgent(uaString);

  if (ua) {
    return ua.isBot || UA_BOTS.some((bot) => new RegExp(bot, "i").test(ua.ua));
  }

  // Check referer
  const referer = req.headers.get("referer");
  if (
    referer &&
    REFERRER_BOTS.some((bot) => new RegExp(bot, "i").test(referer))
  ) {
    return true;
  }

  // Check ip
  let ip = getIpAddress(req);

  if (!ip) {
    return false;
  }

  // Check exact IP matches
  if (IP_BOTS.includes(ip)) {
    return true;
  }

  // Check CIDR ranges
  return IP_RANGES_BOTS.some((range) => isIpInRange(ip, range));
};

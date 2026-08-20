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
  const isUaBot =
    ua.isBot || UA_BOTS.some((bot) => new RegExp(bot, "i").test(ua.ua));

  // Check referer
  const referer = req.headers.get("referer");
  const isRefererBot =
    !!referer &&
    REFERRER_BOTS.some((bot) => new RegExp(bot, "i").test(referer));

  // Check ip
  const ip = getIpAddress(req);
  const isIpBot =
    !!ip &&
    (IP_BOTS.includes(ip) ||
      IP_RANGES_BOTS.some((range) => isIpInRange(ip, range)));

  return isUaBot || isRefererBot || isIpBot;
};

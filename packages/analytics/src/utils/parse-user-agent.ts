/**
 * Parse User-Agent header into browser, device, and OS information.
 * Works in both Node.js and browser environments.
 */
export interface ParsedUserAgent {
  ua: string;
  device: {
    type?: string;
    model?: string;
    vendor?: string;
  };
  browser: {
    name?: string;
    version?: string;
  };
  os: {
    name?: string;
    version?: string;
  };
  engine: {
    name?: string;
    version?: string;
  };
  cpu?: {
    architecture?: string;
  };
  isBot: boolean;
}

export function parseUserAgent(uaString: string = ""): ParsedUserAgent {
  const ua = uaString.toLowerCase();
  const result: ParsedUserAgent = {
    ua: uaString,
    device: {},
    browser: {},
    os: {},
    engine: {},
    cpu: {},
    isBot: false,
  };

  // Detect Bot
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
  ];
  result.isBot = botPatterns.some((pattern) => pattern.test(ua));

  // Device type detection
  if (/mobile|android|iphone|ipod|windows phone/i.test(ua)) {
    result.device.type = "mobile";
  } else if (/tablet|ipad/i.test(ua)) {
    result.device.type = "tablet";
  } else {
    result.device.type = "desktop";
  }

  // Device vendor & model
  if (/iphone|ipod/i.test(ua)) {
    result.device.vendor = "Apple";
    const match = /iphone os (\d+)/i.exec(ua);
    if (match) result.device.model = `iPhone`;
  } else if (/ipad/i.test(ua)) {
    result.device.vendor = "Apple";
    result.device.model = "iPad";
  } else if (/android/i.test(ua)) {
    result.device.vendor = "Android";
  }

  // Browser detection
  if (/edg\//i.test(ua)) {
    result.browser.name = "Edge";
    const match = ua.match(/edg\/(\d+)/i);
    result.browser.version = match ? match[1] : undefined;
  } else if (/chrome/i.test(ua) && !/chromium/i.test(ua)) {
    result.browser.name = "Chrome";
    const match = ua.match(/chrome\/(\d+)/i);
    result.browser.version = match ? match[1] : undefined;
  } else if (/firefox/i.test(ua)) {
    result.browser.name = "Firefox";
    const match = ua.match(/firefox\/(\d+)/i);
    result.browser.version = match ? match[1] : undefined;
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    result.browser.name = "Safari";
    const match = ua.match(/version\/(\d+)/i);
    result.browser.version = match ? match[1] : undefined;
  } else if (/opera|opr/i.test(ua)) {
    result.browser.name = "Opera";
    const match = ua.match(/(?:opera|opr)\/(\d+)/i);
    result.browser.version = match ? match[1] : undefined;
  }

  // OS detection
  if (/windows nt/i.test(ua)) {
    result.os.name = "Windows";
    const match = ua.match(/windows nt ([\d.]+)/i);
    result.os.version = match ? match[1] : undefined;
  } else if (/mac os x/i.test(ua)) {
    result.os.name = "Mac OS";
    const match = ua.match(/mac os x ([\d_]+)/i);
    result.os.version = match ? match[1]?.replace(/_/g, ".") : undefined;
  } else if (/android/i.test(ua)) {
    result.os.name = "Android";
    const match = ua.match(/android ([\d.]+)/i);
    result.os.version = match ? match[1] : undefined;
  } else if (/iphone|ipod|ipad/i.test(ua)) {
    result.os.name = "iOS";
    const match = ua.match(/(?:iphone|ipad) os ([\d_]+)/i);
    result.os.version = match ? match[1]?.replace(/_/g, ".") : undefined;
  } else if (/linux/i.test(ua)) {
    result.os.name = "Linux";
  }

  // Engine detection
  if (/trident/i.test(ua)) {
    result.engine.name = "Trident";
  } else if (/webkit/i.test(ua)) {
    result.engine.name = "WebKit";
  } else if (/gecko/i.test(ua)) {
    result.engine.name = "Gecko";
  }

  return result;
}

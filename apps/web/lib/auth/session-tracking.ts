import { prisma } from "@repo/db";
import { headers } from "next/headers";
import { nanoid } from "@repo/utils";

interface DeviceInfo {
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
}

/**
 * Parse user-agent string into device info.
 * Lightweight parser — no external dependency needed.
 */
export function parseUserAgent(ua: string): DeviceInfo {
  // OS detection
  let os = "Unknown OS";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/CrOS/i.test(ua)) os = "Chrome OS";

  // Browser detection
  let browser = "Unknown Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";

  // Device type
  let deviceType = "desktop";
  if (/Mobile|Android.*Mobile|iPhone|iPod/i.test(ua)) deviceType = "mobile";
  else if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) deviceType = "tablet";

  // Device name
  const deviceName = `${os} Device`;

  return { deviceName, deviceType, browser, os };
}

/**
 * Get the client IP from request headers.
 * Supports x-forwarded-for (proxies/Vercel) and x-real-ip.
 */
export async function getClientIp(): Promise<string | null> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headersList.get("x-real-ip") || null;
}

/**
 * Resolve IP address to a location string.
 * Uses the free ip-api.com service (non-commercial, 45 req/min).
 * Falls back gracefully if the service is unavailable.
 */
export async function resolveLocation(ip: string): Promise<string | null> {
  // Skip private/local IPs
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.")
  ) {
    return null;
  }

  try {
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=city,regionName,country`,
      {
        signal: AbortSignal.timeout(3000),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.city && data.country) {
      return [data.city, data.regionName, data.country]
        .filter(Boolean)
        .join(", ");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a tracked session record when a user signs in.
 * Returns the session token that should be stored in the JWT.
 */
export async function createTrackedSession(
  userId: string,
  userAgent: string,
  ip: string | null
): Promise<string> {
  const device = parseUserAgent(userAgent);
  const location = ip ? await resolveLocation(ip) : null;
  const sessionToken = nanoid(32);

  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      browser: device.browser,
      os: device.os,
      ipAddress: ip,
      location,
      lastActive: new Date(),
    },
  });

  return sessionToken;
}

/**
 * Update the lastActive timestamp on the session.
 * Called periodically (e.g., on JWT refresh).
 */
export async function touchSession(sessionToken: string): Promise<void> {
  try {
    await prisma.session.update({
      where: { sessionToken },
      data: { lastActive: new Date() },
    });
  } catch {
    // Session may have been revoked — ignore
  }
}

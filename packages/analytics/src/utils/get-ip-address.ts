/**
 * Extract IP address from request headers.
 * Supports multiple header types for different environments (Node.js, Vercel, Cloudflare, etc.)
 */
export function getIpAddress(
  req: Request | { headers: Headers }
): string | null {
  // Get headers - support both Request object and plain object with headers
  const headers =
    req instanceof Request
      ? (req as Request).headers
      : (req.headers as Headers);

  // Try common forwarding headers (Vercel, Cloudflare, nginx, etc.)
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, get the first one
    return forwarded.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const clientIp = headers.get("cf-connecting-ip");
  if (clientIp) {
    return clientIp.trim();
  }

  const trueClientIp = headers.get("true-client-ip");
  if (trueClientIp) {
    return trueClientIp.trim();
  }

  // Fallback - return null (will be handled by caller)
  return null;
}

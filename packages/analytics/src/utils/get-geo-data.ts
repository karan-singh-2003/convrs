/**
 * Extract geolocation data from request headers.
 * Supports Vercel headers and falls back to defaults.
 */
export interface GeoData {
  country: string;
  city: string;
  latitude: string;
  longitude: string;
}

export function getGeoData(req: Request): GeoData {
  // Check if we're running on Vercel
  const isVercel = process.env.VERCEL === "1";

  if (isVercel) {
    // Use Vercel headers when available
    return {
      country: req.headers.get("x-vercel-ip-country") ?? "Unknown",
      city: req.headers.get("x-vercel-ip-city") ?? "Unknown",
      latitude: req.headers.get("x-vercel-ip-latitude") ?? "Unknown",
      longitude: req.headers.get("x-vercel-ip-longitude") ?? "Unknown",
    };
  }

  // Fallback for local/non-Vercel environments
  return {
    country: "Unknown",
    city: "Unknown",
    latitude: "0",
    longitude: "0",
  };
}

export function getGeoRegion(req: Request): string {
  const isVercel = process.env.VERCEL === "1";

  if (isVercel) {
    return req.headers.get("x-vercel-ip-country-region") ?? "Unknown";
  }

  return "Unknown";
}

export function getVercelRegion(): string | null {
  if (process.env.VERCEL === "1") {
    return process.env.VERCEL_REGION ?? null;
  }
  return null;
}

export function getContinent(req: Request): string {
  const isVercel = process.env.VERCEL === "1";

  if (isVercel) {
    return req.headers.get("x-vercel-ip-continent") ?? "Unknown";
  }

  return "Unknown";
}

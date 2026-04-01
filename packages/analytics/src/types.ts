/**
 * Type definitions for analytics module
 */

export interface UserAgentInfo {
  ua: string;
  isBot: boolean;
  browser: {
    name?: string;
    version?: string;
  };
  device: {
    type?: string;
    model?: string;
    vendor?: string;
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
}

export interface GeoInfo {
  country: string;
  city: string;
  latitude: string;
  longitude: string;
  region: string;
  continent: string;
  vercelRegion: string | null;
}

export interface RequestContext {
  url: string;
  method: string;
  ip: string;
  userAgent: UserAgentInfo;
  geo: GeoInfo;
  referer: string | null;
  headers: {
    get(name: string): string | null;
  };
}

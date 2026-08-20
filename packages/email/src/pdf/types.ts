export interface WeeklySummaryStats {
  clicks: number;
  revenue: number;
  conversionRate: number;
  bounceRate: number;
  avgSessionDuration: number;
  clicksChangePct: number | null;
  revenueChangePct: number | null;

  topLinks: { url: string; clicks: number }[];
  topPages: { page: string; clicks: number }[];
  topHostnames: { hostname: string; clicks: number }[];
  entryPages: { entrypage: string; clicks: number }[];
  exitLinks: { exitlink: string; clicks: number }[];

  topCountries: { country: string; countryLabel: string; clicks: number }[];
  topRegions: { region: string; clicks: number }[];
  topCities: { city: string; region: string; clicks: number }[];

  devices: { device: string; clicks: number }[];
  browsers: { browser: string; clicks: number }[];
  os: { os: string; clicks: number }[];

  referers: { referer: string; clicks: number }[];
  utmSources: { utm_source: string; clicks: number }[];

  weekStart: string; // ISO, for the PDF header
  weekEnd: string;
  currency: string;
}

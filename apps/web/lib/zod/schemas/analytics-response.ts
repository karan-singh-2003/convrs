import { TRIGGER_TYPES } from "@/lib/analytics/constants";
import { CONTINENT_CODES } from "@repo/utils";
import * as z from "zod/v4";

const analyticsTriggersResponse = z.object({
  trigger: z
    .enum(TRIGGER_TYPES)
    .describe("The type of trigger method: page view"),
  clicks: z
    .number()
    .describe("The number of clicks from this trigger method")
    .default(0),
});

export const analyticsResponse = {
  count: z.object({
    clicks: z.coerce.number().describe("The total number of clicks").default(0),
  }),

  timeseries: z.object({
    start: z.string().describe("The starting timestamp of the interval"),
    clicks: z
      .number()
      .describe("The number of clicks in the interval")
      .default(0),
  }),

  continents: z.object({
    continent: z
      .enum(CONTINENT_CODES)
      .describe(
        "The 2-letter ISO 3166-1 code representing the continent associated with the location of the user."
      ),
    clicks: z
      .number()
      .describe("The number of clicks from this continent")
      .default(0),
  }),

  countries: z.object({
    country: z
      .string()
      .describe(
        "The 2-letter ISO 3166-1 country code of the country. Learn more: https://d.to/geo"
      ),
    region: z.literal("*").default("*"),
    city: z.literal("*").default("*"),
    clicks: z
      .number()
      .describe("The number of clicks from this country")
      .default(0),
  }),

  regions: z.object({
    country: z
      .string()
      .describe(
        "The 2-letter ISO 3166-1 country code of the country. Learn more: https://d.to/geo"
      ),
    region: z
      .string()
      .describe("The 2-letter ISO 3166-2 region code of the region."),
    city: z.literal("*").default("*"),
    clicks: z
      .number()
      .describe("The number of clicks from this region")
      .default(0),
  }),

  cities: z.object({
    country: z
      .string()
      .describe(
        "The 2-letter ISO 3166-1 country code of the country where this city is located. Learn more: https://d.to/geo"
      ),
    region: z
      .string()
      .describe(
        "The 2-letter ISO 3166-2 region code representing the region associated with the location of the user."
      ),
    city: z.string().describe("The name of the city"),
    clicks: z
      .number()
      .describe("The number of clicks from this city")
      .default(0),
  }),

  devices: z.object({
    device: z.string().describe("The name of the device"),
    clicks: z
      .number()
      .describe("The number of clicks from this device")
      .default(0),
  }),

  browsers: z.object({
    browser: z.string().describe("The name of the browser"),
    clicks: z
      .number()
      .describe("The number of clicks from this browser")
      .default(0),
  }),

  os: z.object({
    os: z.string().describe("The name of the OS"),
    clicks: z.number().describe("The number of clicks from this OS").default(0),
  }),

  triggers: analyticsTriggersResponse,
  trigger: analyticsTriggersResponse, // backwards compatibility

  referers: z.object({
    referer: z
      .string()
      .describe("The name of the referer. If unknown, this will be `(direct)`"),
    clicks: z
      .number()
      .describe("The number of clicks from this referer")
      .default(0),
  }),

  referer_urls: z.object({
    refererUrl: z
      .string()
      .describe(
        "The full URL of the referer. If unknown, this will be `(direct)`"
      ),
    clicks: z
      .number()
      .describe("The number of clicks from this referer to this URL")
      .default(0),
  }),

  top_urls: z.object({
    url: z
      .string()
      .describe("The full destination URL (including query parameters)"),
    clicks: z
      .number()
      .describe("The number of clicks from this URL")
      .default(0),
  }),

  top_base_urls: z.object({
    url: z
      .string()
      .describe("The base URL (destination URL without query parameters)"),
    clicks: z
      .number()
      .describe("The number of clicks from this base URL")
      .default(0),
  }),

  utm_sources: z.object({
    utm_source: z.string().describe("The UTM source"),
    clicks: z
      .number()
      .describe("The number of clicks with this UTM source")
      .default(0),
  }),

  utm_mediums: z.object({
    utm_medium: z.string().describe("The UTM medium"),
    clicks: z
      .number()
      .describe("The number of clicks with this UTM medium")
      .default(0),
  }),

  utm_campaigns: z.object({
    utm_campaign: z.string().describe("The UTM campaign"),
    clicks: z
      .number()
      .describe("The number of clicks with this UTM campaign")
      .default(0),
  }),

  utm_terms: z.object({
    utm_term: z.string().describe("The UTM term"),
    clicks: z
      .number()
      .describe("The number of clicks with this UTM term")
      .default(0),
  }),

  utm_contents: z.object({
    utm_content: z.string().describe("The UTM content"),
    clicks: z
      .number()
      .describe("The number of clicks with this UTM content")
      .default(0),
  }),

  top_folders: z.object({
    folderId: z.string().describe("The ID of the folder"),
    folder: z.object({
      id: z.string().describe("The ID of the folder"),
      name: z.string().describe("The name of the folder"),
    }),
    clicks: z.number().describe("The total number of clicks").default(0),
  }),
} as const;

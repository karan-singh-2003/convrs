import { NextResponse } from "next/server";
import { APP_DOMAIN } from "@repo/utils";
import { zodQueryToOpenApiParams } from "@/lib/api/v1/openapi";
import { PUBLIC_METRICS } from "@/lib/api/v1/metrics";
import { querySchema as analyticsQuery } from "../analytics/route";
import { querySchema as timeseriesQuery } from "../analytics/timeseries/route";
import { querySchema as pagesQuery } from "../analytics/pages/route";
import { querySchema as sourcesQuery } from "../analytics/sources/route";
import { querySchema as geoQuery } from "../analytics/geo/route";
import { querySchema as devicesQuery } from "../analytics/devices/route";
import { querySchema as revenueQuery } from "../analytics/revenue/route";
import { querySchema as botsQuery } from "../analytics/bots/route";
import { querySchema as goalsListQuery } from "../goals/route";
import { querySchema as goalsAnalyticsQuery } from "../analytics/goals/route";
import { querySchema as customersQuery } from "../customers/route";
import { querySchema as paymentsQuery } from "../payments/route";
import { querySchema as funnelsQuery } from "../funnels/route";
import { querySchema as goalPropertiesQuery } from "../analytics/goals/properties/route";
import { querySchema as revenueTimeseriesQuery } from "../analytics/revenue/timeseries/route";
import { querySchema as revenueBySourceQuery } from "../analytics/revenue/by-source/route";
import { querySchema as revenueByCampaignQuery } from "../analytics/revenue/by-campaign/route";
import { querySchema as revenueByPageQuery } from "../analytics/revenue/by-page/route";

const dataEnvelope = (schema: object) => ({
  type: "object",
  properties: { data: schema },
  required: ["data"],
});

const paginatedEnvelope = (itemSchema: object) => ({
  type: "object",
  properties: {
    data: { type: "array", items: itemSchema },
    pagination: {
      type: "object",
      properties: {
        page: { type: "integer" },
        limit: { type: "integer" },
        hasMore: { type: "boolean" },
      },
      required: ["page", "limit", "hasMore"],
    },
  },
  required: ["data", "pagination"],
});

const errorResponse = {
  description: "Error",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
    },
  },
};

function readOp({
  summary,
  scope,
  querySchema,
  responseSchema,
}: {
  summary: string;
  scope: string | null;
  querySchema?: any;
  responseSchema: object;
}) {
  return {
    get: {
      summary,
      security: [{ bearerAuth: [] }],
      "x-required-scope": scope,
      parameters: querySchema ? zodQueryToOpenApiParams(querySchema) : [],
      responses: {
        "200": {
          description: "OK",
          content: { "application/json": { schema: responseSchema } },
        },
        "400": errorResponse,
        "401": errorResponse,
        "403": errorResponse,
        "429": errorResponse,
      },
    },
  };
}

const metricValueSchema = Object.fromEntries(
  PUBLIC_METRICS.map((m) => [m, { type: "number" }])
);

// GET /api/v1/openapi.json — generated from the same zod schemas that
// validate each route's real query params (see lib/api/v1/openapi.ts), so
// this can't silently drift from what the API actually accepts. Public,
// unauthenticated — the spec itself isn't sensitive.
export function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Convrs API",
      version: "1.0.0",
      description:
        "Read access to the analytics and revenue data your API token is authorized for.",
    },
    servers: [{ url: `${APP_DOMAIN}/api/v1` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "API token created from Settings → API Tokens. Format: `cvrs_...` (or legacy `bc_...`).",
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/account": readOp({
        summary: "Get authenticated account context",
        scope: null,
        responseSchema: dataEnvelope({
          type: "object",
          properties: {
            user: { type: ["object", "null"] },
            website: { type: "object" },
            token: { type: "object" },
            plan: { type: "object" },
          },
        }),
      }),
      "/websites": readOp({
        summary: "List websites accessible to this token",
        scope: "websites.read",
        responseSchema: dataEnvelope({ type: "array", items: { type: "object" } }),
      }),
      "/websites/{websiteId}": readOp({
        summary: "Get a website by ID",
        scope: "websites.read",
        responseSchema: dataEnvelope({ type: "object" }),
      }),
      "/analytics": readOp({
        summary: "Analytics overview for a date range",
        scope: "analytics.read",
        querySchema: analyticsQuery,
        responseSchema: dataEnvelope({ type: "object", properties: metricValueSchema }),
      }),
      "/analytics/timeseries": readOp({
        summary: "Analytics broken down by time interval",
        scope: "analytics.read",
        querySchema: timeseriesQuery,
        responseSchema: dataEnvelope({
          type: "array",
          items: {
            type: "object",
            properties: { date: { type: "string", format: "date-time" }, ...metricValueSchema },
          },
        }),
      }),
      "/analytics/pages": readOp({
        summary: "Analytics broken down by page/hostname/entry page/exit link",
        scope: "analytics.read",
        querySchema: pagesQuery,
        responseSchema: paginatedEnvelope({ type: "object" }),
      }),
      "/analytics/sources": readOp({
        summary: "Analytics broken down by referrer/UTM parameters",
        scope: "analytics.read",
        querySchema: sourcesQuery,
        responseSchema: paginatedEnvelope({ type: "object" }),
      }),
      "/analytics/geo": readOp({
        summary: "Analytics broken down by country/region/city/continent",
        scope: "analytics.read",
        querySchema: geoQuery,
        responseSchema: paginatedEnvelope({ type: "object" }),
      }),
      "/analytics/devices": readOp({
        summary: "Analytics broken down by device/browser/OS",
        scope: "analytics.read",
        querySchema: devicesQuery,
        responseSchema: paginatedEnvelope({ type: "object" }),
      }),
      "/analytics/revenue": readOp({
        summary: "Revenue-focused analytics snapshot",
        scope: "analytics.read",
        querySchema: revenueQuery,
        responseSchema: dataEnvelope({
          type: "object",
          properties: { currency: { type: "string" }, ...metricValueSchema },
        }),
      }),
      "/analytics/realtime": readOp({
        summary: "Live visitor count, pages, referrers, countries, and geo points",
        scope: "analytics.read",
        responseSchema: dataEnvelope({
          type: "object",
          properties: {
            count: { type: "integer" },
            pages: { type: "array", items: { type: "object" } },
            points: { type: "array", items: { type: "object" } },
            referrers: { type: "array", items: { type: "object" } },
            countries: { type: "array", items: { type: "object" } },
          },
        }),
      }),
      "/analytics/bots": readOp({
        summary: "AI-crawler / bot traffic analytics",
        scope: "analytics.read",
        querySchema: botsQuery,
        responseSchema: dataEnvelope({ type: ["object", "array"] }),
      }),
      "/goals": readOp({
        summary: "List this website's tracked goals",
        scope: "goals.read",
        querySchema: goalsListQuery,
        responseSchema: paginatedEnvelope({
          type: "object",
          properties: {
            eventName: { type: "string" },
            eventType: { type: "string" },
            trigger: { type: ["string", "null"] },
            firstSeenAt: { type: "string", format: "date-time" },
            lastSeenAt: { type: "string", format: "date-time" },
          },
        }),
      }),
      "/analytics/goals": readOp({
        summary: "Goal completions over time",
        scope: "goals.read",
        querySchema: goalsAnalyticsQuery,
        responseSchema: dataEnvelope({
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              goal: { type: "string" },
              count: { type: "integer" },
            },
          },
        }),
      }),
      "/customers": readOp({
        summary: "List customers (identified and anonymous visitors)",
        scope: "analytics.read",
        querySchema: customersQuery,
        responseSchema: paginatedEnvelope({ type: "object" }),
      }),
      "/customers/{customerId}": readOp({
        summary: "Get a customer by ID",
        scope: "analytics.read",
        responseSchema: dataEnvelope({ type: "object" }),
      }),
      "/customers/{customerId}/activity": readOp({
        summary: "A customer's event history, grouped by day",
        scope: "analytics.read",
        responseSchema: dataEnvelope({
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              items: { type: "array", items: { type: "object" } },
            },
          },
        }),
      }),
      "/payments": readOp({
        summary: "List payments (redacted — no provider identifiers or customer email)",
        scope: "payments.read",
        querySchema: paymentsQuery,
        responseSchema: paginatedEnvelope({
          type: "object",
          properties: {
            id: { type: "string" },
            amount: { type: "integer" },
            currency: { type: "string" },
            provider: { type: "string" },
            isRecurring: { type: "boolean" },
            billingInterval: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
            attributionStatus: { type: "string" },
            customerId: { type: "string" },
          },
        }),
      }),
      "/meta": readOp({
        summary: "Supported metrics, dimensions, and this website's goal catalogue",
        scope: null,
        responseSchema: dataEnvelope({ type: "object" }),
      }),
      "/funnels": readOp({
        summary: "List this website's funnel definitions",
        scope: "analytics.read",
        querySchema: funnelsQuery,
        responseSchema: paginatedEnvelope({
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  value: { type: "string" },
                  type: { type: "string", enum: ["goal", "page_view"] },
                  order: { type: "integer" },
                },
              },
            },
          },
        }),
      }),
      "/funnels/{funnelId}": readOp({
        summary: "Get a funnel's definition and ordered steps",
        scope: "analytics.read",
        responseSchema: dataEnvelope({ type: "object" }),
      }),
      "/analytics/funnels/{funnelId}": readOp({
        summary: "Step-by-step conversion counts and top sources/countries for a funnel",
        scope: "analytics.read",
        responseSchema: dataEnvelope({
          type: "array",
          items: {
            type: "object",
            properties: {
              step: { type: "string" },
              users: { type: "integer" },
              topSources: { type: "array", items: { type: "object" } },
              topCountries: { type: "array", items: { type: "object" } },
            },
          },
        }),
      }),
      "/analytics/goals/properties": readOp({
        summary: "Custom event-property breakdown for goal completions",
        scope: "goals.read",
        querySchema: goalPropertiesQuery,
        responseSchema: paginatedEnvelope({
          type: "object",
          properties: {
            propertyKey: { type: "string" },
            propertyValue: { type: "string" },
            count: { type: "integer" },
          },
        }),
      }),
      "/analytics/revenue/timeseries": readOp({
        summary: "Revenue over time",
        scope: "analytics.read",
        querySchema: revenueTimeseriesQuery,
        responseSchema: dataEnvelope({
          type: "object",
          properties: {
            currency: { type: "string" },
            points: {
              type: "array",
              items: {
                type: "object",
                properties: { date: { type: "string", format: "date-time" } },
              },
            },
          },
        }),
      }),
      "/analytics/revenue/by-source": readOp({
        summary: "Revenue grouped by referrer/UTM parameters (last-touch attribution)",
        scope: "analytics.read",
        querySchema: revenueBySourceQuery,
        responseSchema: paginatedEnvelope({ type: "object" }),
      }),
      "/analytics/revenue/by-campaign": readOp({
        summary: "Revenue grouped by campaign (last-touch attribution)",
        scope: "analytics.read",
        querySchema: revenueByCampaignQuery,
        responseSchema: paginatedEnvelope({ type: "object" }),
      }),
      "/analytics/revenue/by-page": readOp({
        summary: "Revenue grouped by page/hostname (last-touch attribution)",
        scope: "analytics.read",
        querySchema: revenueByPageQuery,
        responseSchema: paginatedEnvelope({ type: "object" }),
      }),
    },
  };

  return NextResponse.json(spec);
}

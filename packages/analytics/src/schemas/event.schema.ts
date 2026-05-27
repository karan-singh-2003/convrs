// packages/analytics/src/schemas/event.schema.ts
import { z } from "zod";

export const AnalyticsEventSchema = z
  .object({
    // ── Base (always present) ─────────────────────────────────────────────────
    website_id: z.string().min(1).max(64),
    workspace_id: z.string().min(1).max(64),
    visitor_id: z.string().min(1).max(128),
    customer_id: z.string().min(1).max(128).optional(),
    session_id: z.string().min(1).max(128),
    type: z.enum(["pageview", "event", "identify", "payment", "refund"]),
    url: z.string().url(),
    hostname: z.string().optional(),
    referrer: z.string().nullable().optional(),
    title: z.string().optional(),
    language: z.string().optional(),
    timezone: z.string().optional(),
    timestamp: z.string().datetime().optional(),
    screen_w: z.number().int().min(0).optional(),
    screen_h: z.number().int().min(0).optional(),
    viewport_w: z.number().int().min(0).optional(),
    viewport_h: z.number().int().min(0).optional(),

    // ── type = "event" ────────────────────────────────────────────────────────
    event_name: z.string().min(1).max(64).optional(),
    props: z.record(z.string(), z.unknown()).optional(),

    // ── type = "identify" ─────────────────────────────────────────────────────
    traits: z.record(z.string(), z.unknown()).optional(),

    // ── type = "payment" | "refund" ───────────────────────────────────────────
    revenue: z
      .object({
        amount: z.number(),
        currency: z.string().length(3),
        provider: z.enum([
          "stripe",
          "lemonsqueezy",
          "polar",
          "paddle",
          "manual",
        ]),
        provider_id: z.string().optional(),
        email: z.string().email().optional(),
        plan: z.string().optional(),
        payment_type: z.enum(["one_time", "subscription"]).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "event" && !data.event_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "event_name required for type=event",
        path: ["event_name"],
      });
    }
    if (data.type === "identify" && !data.traits?.user_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "traits.user_id required for type=identify",
        path: ["traits"],
      });
    }
    if ((data.type === "payment" || data.type === "refund") && !data.revenue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "revenue required for type=payment/refund",
        path: ["revenue"],
      });
    }
  });

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

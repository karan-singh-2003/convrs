import crypto from "node:crypto";
import { test, expect } from "@playwright/test";
import { prisma } from "../fixtures/db";
import {
  createTrackingWorkspace,
  createStripeIntegration,
  createLemonSqueezyIntegration,
  randomToken,
} from "../fixtures/seed";
import {
  signStripePayload,
  buildCheckoutSessionCompletedPayload,
} from "../fixtures/stripe-signature";
import { INGEST_BASE_URL, STRIPE_WEBHOOK_SECRET } from "../fixtures/env";

test.describe("revenue webhook verification", () => {
  test.describe("Stripe (SDK-delegated verification)", () => {
    test("valid signature is accepted and the payment is recorded", async ({ request }) => {
      const ws = await createTrackingWorkspace("stripe-valid");
      await createStripeIntegration(ws.id, STRIPE_WEBHOOK_SECRET);

      const eventId = randomToken("evt");
      const payload = buildCheckoutSessionCompletedPayload({
        sessionId: randomToken("cs"),
        eventId,
        amountTotal: 4900,
        currency: "usd",
        customerEmail: "e2e-payer@example.com",
      });
      const { signatureHeader } = signStripePayload(payload, STRIPE_WEBHOOK_SECRET);

      const response = await request.post(
        `${INGEST_BASE_URL}/api/stripe/webhook/${ws.id}`,
        {
          headers: {
            "content-type": "application/json",
            "stripe-signature": signatureHeader,
          },
          data: payload,
        }
      );

      expect(response.ok()).toBe(true);

      const payment = await prisma.payment.findUnique({
        where: { provider_externalEventId: { provider: "stripe", externalEventId: eventId } },
      });
      expect(payment).not.toBeNull();
      expect(payment?.amount).toBe(4900);
    });

    test("tampered payload after signing is rejected, and nothing is recorded", async ({
      request,
    }) => {
      const ws = await createTrackingWorkspace("stripe-tampered");
      await createStripeIntegration(ws.id, STRIPE_WEBHOOK_SECRET);

      const eventId = randomToken("evt");
      const payload = buildCheckoutSessionCompletedPayload({
        sessionId: randomToken("cs"),
        eventId,
        amountTotal: 4900,
        currency: "usd",
        customerEmail: "e2e-payer@example.com",
      });
      const { signatureHeader } = signStripePayload(payload, STRIPE_WEBHOOK_SECRET);

      // Sign the real payload, then send a different body — the signature no
      // longer matches what's being verified.
      const tamperedPayload = payload.replace('"amount_total":4900', '"amount_total":999999');

      const response = await request.post(
        `${INGEST_BASE_URL}/api/stripe/webhook/${ws.id}`,
        {
          headers: {
            "content-type": "application/json",
            "stripe-signature": signatureHeader,
          },
          data: tamperedPayload,
        }
      );

      expect(response.status()).toBe(400);

      const payment = await prisma.payment.findUnique({
        where: { provider_externalEventId: { provider: "stripe", externalEventId: eventId } },
      });
      expect(payment).toBeNull();
    });

    test("missing signature header is rejected", async ({ request }) => {
      const ws = await createTrackingWorkspace("stripe-missing-sig");
      await createStripeIntegration(ws.id, STRIPE_WEBHOOK_SECRET);

      const payload = buildCheckoutSessionCompletedPayload({
        sessionId: randomToken("cs"),
        eventId: randomToken("evt"),
        amountTotal: 1000,
        currency: "usd",
        customerEmail: "e2e-payer@example.com",
      });

      const response = await request.post(
        `${INGEST_BASE_URL}/api/stripe/webhook/${ws.id}`,
        { headers: { "content-type": "application/json" }, data: payload }
      );

      expect(response.status()).toBe(400);
    });
  });

  test.describe("LemonSqueezy (hand-rolled HMAC verification)", () => {
    function signLemonSqueezy(rawBody: string, secret: string): string {
      return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    }

    function buildOrderCreatedPayload(opts: { orderId: string; total: number }) {
      return JSON.stringify({
        meta: { event_name: "order_created", custom_data: {} },
        data: {
          id: opts.orderId,
          attributes: { total: opts.total, currency: "usd", user_email: "e2e-payer@example.com" },
        },
      });
    }

    test("valid HMAC signature is accepted and recorded", async ({ request }) => {
      const ws = await createTrackingWorkspace("lemonsqueezy-valid");
      const secret = "e2e_lemonsqueezy_secret";
      await createLemonSqueezyIntegration(ws.id, secret);

      const orderId = randomToken("order");
      const body = buildOrderCreatedPayload({ orderId, total: 2500 });
      const signature = signLemonSqueezy(body, secret);

      const response = await request.post(
        `${INGEST_BASE_URL}/api/lemonsqueezy/webhook/${ws.id}`,
        {
          headers: { "content-type": "application/json", "x-signature": signature },
          data: body,
        }
      );

      expect(response.ok()).toBe(true);

      const externalEventId = `${orderId}:order_created`;
      const payment = await prisma.payment.findUnique({
        where: {
          provider_externalEventId: { provider: "lemonsqueezy", externalEventId },
        },
      });
      expect(payment).not.toBeNull();
      expect(payment?.amount).toBe(2500);
    });

    test("tampered body with a stale signature is rejected, nothing recorded", async ({
      request,
    }) => {
      const ws = await createTrackingWorkspace("lemonsqueezy-tampered");
      const secret = "e2e_lemonsqueezy_secret_2";
      await createLemonSqueezyIntegration(ws.id, secret);

      const orderId = randomToken("order");
      const originalBody = buildOrderCreatedPayload({ orderId, total: 2500 });
      const staleSignature = signLemonSqueezy(originalBody, secret);
      const tamperedBody = buildOrderCreatedPayload({ orderId, total: 999999 });

      const response = await request.post(
        `${INGEST_BASE_URL}/api/lemonsqueezy/webhook/${ws.id}`,
        {
          headers: { "content-type": "application/json", "x-signature": staleSignature },
          data: tamperedBody,
        }
      );

      expect(response.status()).toBe(400);

      const externalEventId = `${orderId}:order_created`;
      const payment = await prisma.payment.findUnique({
        where: {
          provider_externalEventId: { provider: "lemonsqueezy", externalEventId },
        },
      });
      expect(payment).toBeNull();
    });
  });
});

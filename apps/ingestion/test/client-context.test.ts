import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getClientContext,
  hasValidForwardSecret,
  missingForwardSecretError,
  normalizeIp,
  resolveClientIpHeader,
  resolveTrustProxySetting,
} from "../src/lib/client-context.js";

const SECRET = "test-forward-secret-0123456789";

function req(headers: Record<string, string>, ip = "10.0.0.5") {
  return { headers, ip, socket: { remoteAddress: ip } };
}

test("missing INGEST_FORWARD_SECRET is reported in production (NODE_ENV or Render), never in development", () => {
  for (const env of [{ NODE_ENV: "production" }, { RENDER: "true" }, { NODE_ENV: "production", INGEST_FORWARD_SECRET: "  " }]) {
    const message = missingForwardSecretError(env);
    assert.match(message ?? "", /INGEST_FORWARD_SECRET is not set in production/, JSON.stringify(env));
  }
  assert.equal(missingForwardSecretError({ NODE_ENV: "production", INGEST_FORWARD_SECRET: SECRET }), null);
  assert.equal(missingForwardSecretError({ NODE_ENV: "development" }), null);
  assert.equal(missingForwardSecretError({}), null);
});

test("the missing-secret message never contains the secret", () => {
  // Only reachable when the secret is absent, but guard the contract anyway.
  const message = missingForwardSecretError({ RENDER: "true", INGEST_FORWARD_SECRET: "" }) ?? "";
  assert.ok(!message.includes(SECRET));
});

test("rollout window: the proxy's legacy x-forwarded-for / x-vercel-ip-* headers are ignored, signed values win", () => {
  const legacyAndSigned = {
    "x-forwarded-for": "198.51.100.1",
    "x-vercel-ip-country": "FR",
    "x-convrs-forward-secret": SECRET,
    "x-convrs-client-ip": "203.0.113.9",
    "x-convrs-geo-country": "DE",
  };
  const env = { INGEST_FORWARD_SECRET: SECRET, RENDER: "true" };
  const signed = getClientContext(req({ ...legacyAndSigned, "cf-connecting-ip": "34.1.2.3" }), env);
  assert.equal(signed.source, "signed-forward");
  assert.equal(signed.ip, "203.0.113.9");
  assert.equal(signed.geo.country, "DE");

  // Same legacy headers without a valid signature: still never trusted.
  const unsigned = getClientContext(
    req({ ...legacyAndSigned, "x-convrs-forward-secret": "wrong", "cf-connecting-ip": "34.1.2.3" }),
    env
  );
  assert.equal(unsigned.source, "edge-header");
  assert.equal(unsigned.ip, "34.1.2.3");
  assert.notEqual(unsigned.geo.country, "FR");
});

test("x-debug-ip and raw x-forwarded-for are never trusted", () => {
  const ctx = getClientContext(
    req({ "x-debug-ip": "8.8.8.8", "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" }, "198.51.100.7"),
    {}
  );
  assert.equal(ctx.ip, "198.51.100.7");
  assert.equal(ctx.source, "socket");
});

test("forged x-vercel geo / client-ip headers are ignored without the forward secret", () => {
  const ctx = getClientContext(
    req({
      "x-convrs-client-ip": "1.2.3.4",
      "x-convrs-geo-country": "FR",
      "x-vercel-ip-country": "FR",
      "x-convrs-forward-secret": "wrong",
    }),
    { INGEST_FORWARD_SECRET: SECRET }
  );
  assert.equal(ctx.ip, "10.0.0.5");
  assert.equal(ctx.geo.country, null);
});

test("a signed forward from apps/web supplies IP and geo", () => {
  const ctx = getClientContext(
    req({
      "x-convrs-forward-secret": SECRET,
      "x-convrs-client-ip": "203.0.113.9",
      "x-convrs-geo-country": "de",
      "x-convrs-geo-city": "M%C3%BCnchen",
      "x-convrs-geo-latitude": "48.1",
      "x-convrs-geo-longitude": "not-a-number",
    }),
    { INGEST_FORWARD_SECRET: SECRET }
  );
  assert.equal(ctx.source, "signed-forward");
  assert.equal(ctx.ip, "203.0.113.9");
  assert.equal(ctx.geo.country, "DE");
  assert.equal(ctx.geo.city, "München");
  assert.equal(ctx.geo.latitude, "48.1");
  assert.equal(ctx.geo.longitude, null);
});

test("a signed forward with no client IP yields null, not the proxy's socket IP", () => {
  const ctx = getClientContext(req({ "x-convrs-forward-secret": SECRET }), { INGEST_FORWARD_SECRET: SECRET });
  assert.equal(ctx.ip, null);
});

test("forward secret is not accepted when the server has none configured", () => {
  assert.equal(hasValidForwardSecret(req({ "x-convrs-forward-secret": "" }), {}), false);
  assert.equal(hasValidForwardSecret(req({ "x-convrs-forward-secret": "x" }), {}), false);
});

test("on Render the Cloudflare connecting IP and country are used", () => {
  assert.equal(resolveClientIpHeader({ RENDER: "true" }), "cf-connecting-ip");
  const ctx = getClientContext(
    req({ "cf-connecting-ip": "2001:db8::1", "cf-ipcountry": "in", "x-forwarded-for": "1.1.1.1" }),
    { RENDER: "true" }
  );
  assert.equal(ctx.ip, "2001:db8::1");
  assert.equal(ctx.geo.country, "IN");
});

test("Cloudflare's XX / T1 pseudo-countries are treated as unknown", () => {
  const ctx = getClientContext(req({ "cf-connecting-ip": "203.0.113.1", "cf-ipcountry": "T1" }), {
    CLIENT_IP_HEADER: "cf-connecting-ip",
  });
  assert.equal(ctx.geo.country, null);
});

test("a configured edge header that is missing yields null instead of falling back", () => {
  const ctx = getClientContext(req({ "x-forwarded-for": "1.2.3.4" }), { CLIENT_IP_HEADER: "fly-client-ip" });
  assert.equal(ctx.ip, null);
});

test("normalizeIp accepts IPv4/IPv6 and rejects junk", () => {
  assert.equal(normalizeIp("::ffff:203.0.113.4"), "203.0.113.4");
  assert.equal(normalizeIp("203.0.113.4:443"), "203.0.113.4");
  assert.equal(normalizeIp("[2001:db8::2]"), "2001:db8::2");
  assert.equal(normalizeIp(" 198.51.100.1 , 10.0.0.1"), "198.51.100.1");
  assert.equal(normalizeIp("not-an-ip"), null);
  assert.equal(normalizeIp("<script>"), null);
  assert.equal(normalizeIp(""), null);
});

test("trust proxy is off unless configured", () => {
  assert.equal(resolveTrustProxySetting({}), false);
  assert.equal(resolveTrustProxySetting({ TRUST_PROXY: "2" }), 2);
  assert.equal(resolveTrustProxySetting({ TRUST_PROXY: "loopback" }), "loopback");
});

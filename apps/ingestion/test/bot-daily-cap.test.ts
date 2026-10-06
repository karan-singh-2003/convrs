import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  DEFAULT_BOT_DAILY_CAP,
  botCapKey,
  botDailyCap,
  claimBotDailyCap,
  releaseBotDailyCap,
  secondsUntilUtcMidnight,
} from "../src/lib/bot-daily-cap.js";

function fakeRedis() {
  const store = new Map<string, number>();
  const ttl = new Map<string, number>();
  return {
    store,
    ttl,
    async incr(key: string) {
      const n = (store.get(key) ?? 0) + 1;
      store.set(key, n);
      return n;
    },
    async expire(key: string, seconds: number) {
      ttl.set(key, seconds);
    },
    async decr(key: string) {
      store.set(key, (store.get(key) ?? 0) - 1);
    },
  };
}

const NOW = new Date("2026-10-07T23:59:30Z");

test("allows events up to the daily cap, then refuses", async () => {
  const redis = fakeRedis();
  const results = [];
  for (let i = 0; i < 4; i++) results.push(await claimBotDailyCap("ws_1", { cap: 3, now: NOW, redis }));
  assert.deepEqual(
    results.map((r) => r.allowed),
    [true, true, true, false]
  );
  assert.equal(redis.ttl.get("botcap:ws_1:2026-10-07"), 2 * 24 * 60 * 60, "the day's key expires on its own");
});

test("the cap is per workspace and per UTC day", async () => {
  const redis = fakeRedis();
  assert.equal((await claimBotDailyCap("ws_1", { cap: 1, now: NOW, redis })).allowed, true);
  assert.equal((await claimBotDailyCap("ws_2", { cap: 1, now: NOW, redis })).allowed, true, "other workspace");
  const nextDay = new Date("2026-10-08T00:00:01Z");
  assert.equal((await claimBotDailyCap("ws_1", { cap: 1, now: nextDay, redis })).allowed, true, "resets at UTC midnight");
  assert.equal(botCapKey("ws_1", nextDay), "botcap:ws_1:2026-10-08");
  assert.equal(secondsUntilUtcMidnight(NOW), 30);
});

test("release gives back the unit on the key it was claimed under", async () => {
  const redis = fakeRedis();
  const claim = await claimBotDailyCap("ws_1", { cap: 1, now: NOW, redis });
  assert.equal(claim.allowed, true);
  if (claim.allowed) await releaseBotDailyCap(claim.key, redis);
  assert.equal(redis.store.get("botcap:ws_1:2026-10-07"), 0);
  assert.equal((await claimBotDailyCap("ws_1", { cap: 1, now: NOW, redis })).allowed, true);
});

test("fails open when Redis is unavailable (bot events no longer share the human quota)", async () => {
  const broken = {
    incr: async () => {
      throw new Error("down");
    },
    expire: async () => undefined,
    decr: async () => undefined,
  };
  const claim = await claimBotDailyCap("ws_1", { cap: 1, now: NOW, redis: broken });
  assert.equal(claim.allowed, true);
});

test("cap is configurable, with a safe default", () => {
  assert.equal(botDailyCap({}), DEFAULT_BOT_DAILY_CAP);
  assert.equal(botDailyCap({ AI_CRAWLS_DAILY_CAP_PER_WORKSPACE: "20000" }), 20_000);
  assert.equal(botDailyCap({ AI_CRAWLS_DAILY_CAP_PER_WORKSPACE: "-5" }), DEFAULT_BOT_DAILY_CAP);
  assert.equal(botDailyCap({ AI_CRAWLS_DAILY_CAP_PER_WORKSPACE: "abc" }), DEFAULT_BOT_DAILY_CAP);
});

// ── Auth default migration: new workspaces only ───────────────────────────────

const SCHEMA_DIR = new URL("../../../packages/db/schema/", import.meta.url);

test("new workspaces default to optional Bot Traffic auth", () => {
  const schema = readFileSync(new URL("workspace.prisma", SCHEMA_DIR), "utf8");
  assert.match(schema, /botTrafficRequireAuth\s+Boolean\s+@default\(false\)/);
});

test("the default-flip migration never rewrites existing workspaces' stored setting", () => {
  const dir = readdirSync(new URL("migrations/", SCHEMA_DIR)).find((d) =>
    d.endsWith("_bot_traffic_require_auth_default_false")
  );
  assert.ok(dir, "migration exists");
  const sql = readFileSync(new URL(`migrations/${dir}/migration.sql`, SCHEMA_DIR), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert.match(sql, /ALTER TABLE "Workspace" ALTER COLUMN "botTrafficRequireAuth" SET DEFAULT false;/);
  assert.doesNotMatch(sql, /\bUPDATE\b|\bDELETE\b|\bINSERT\b|DROP|NOT NULL/i);
});

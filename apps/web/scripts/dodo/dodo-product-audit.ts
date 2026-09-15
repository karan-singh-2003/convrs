/**
 * apps/web/scripts/dodo/dodo-product-audit.ts
 *
 * DEPLOY 0 — create + verify the 36 Convrs workspace-subscription products in
 * Dodo Payments, from products-spec.ts.
 *
 * Modes:
 *   --list      (read-only)  list every Convrs-tagged recurring product in Dodo
 *   --verify    (read-only, DEFAULT) check each spec product against Dodo
 *                            (runs the --catalog cross-check first)
 *   --catalog   (read-only, NO network) assert the runtime pricing catalog
 *                            (@repo/utils / packages/utils/.../pricing.tsx) agrees
 *                            with products-spec.ts + products.created.json — the
 *                            three independent transcriptions of the approved
 *                            pricing table must match (D16).
 *   --create    (WRITE)      create any spec product that doesn't exist yet,
 *                            recording its id in products.created.json
 *
 * Safety:
 *   --create refuses to run unless DODO_PAYMENTS_ENVIRONMENT === "test_mode",
 *   UNLESS both --allow-live AND DODO_ALLOW_LIVE_WRITES=1 are set.
 *   --create is idempotent + resumable: it skips a spec product that already
 *   has an id in products.created.json OR that already exists in Dodo with a
 *   matching metadata.spec_key.
 *
 * Run (loads apps/web/.env):
 *   node --env-file=.env \
 *     ../../node_modules/.pnpm/tsx@4.7.0/node_modules/tsx/dist/cli.mjs \
 *     scripts/dodo/dodo-product-audit.ts --list
 *
 * or via the documented wrapper:
 *   pnpm --filter web exec dotenv-flow -e .env -- tsx scripts/dodo/dodo-product-audit.ts --verify
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import DodoPayments from "dodopayments";
import {
  PRODUCT_SPECS,
  APPROVED_PRICING,
  CURRENCY,
  TAX_CATEGORY,
  TAX_INCLUSIVE,
  PURCHASING_POWER_PARITY,
  DISCOUNT,
  SUBSCRIPTION_PERIOD_INTERVAL,
  SUBSCRIPTION_PERIOD_COUNT,
  TRIAL_PERIOD_DAYS,
  type DodoProductSpec,
} from "./products-spec";
import {
  PRICING_FAMILIES,
  getProductIdByTier,
  TIER_EVENTS,
  FAMILY_LIMITS,
} from "@repo/utils";

const HERE = dirname(fileURLToPath(import.meta.url));
// Test Mode and Live Mode are separate Dodo catalogs — each gets its own
// created-ids record so a live run can never mistake a Test Mode id for an
// already-created Live Mode product (or vice versa).
const CREATED_PATH = join(
  HERE,
  process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
    ? "products.created.live.json"
    : "products.created.json",
);

type CreatedMap = Record<string, string>; // spec_key -> product_id

function loadCreated(): CreatedMap {
  if (!existsSync(CREATED_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CREATED_PATH, "utf8")) as CreatedMap;
  } catch {
    return {};
  }
}
function saveCreated(map: CreatedMap) {
  const ordered: CreatedMap = {};
  for (const s of PRODUCT_SPECS) if (map[s.key]) ordered[s.key] = map[s.key];
  writeFileSync(CREATED_PATH, JSON.stringify(ordered, null, 2) + "\n", "utf8");
}

const args = new Set(process.argv.slice(2));
const MODE: "list" | "verify" | "create" | "catalog" = args.has("--create")
  ? "create"
  : args.has("--list")
    ? "list"
    : args.has("--catalog")
      ? "catalog"
      : "verify";

const ENV = process.env.DODO_PAYMENTS_ENVIRONMENT ?? "test_mode";
// --catalog is a pure offline cross-check; it needs no API key.
if (MODE !== "catalog" && !process.env.DODO_PAYMENTS_API_KEY) {
  console.error("Missing DODO_PAYMENTS_API_KEY (load apps/web/.env — see the header comment).");
  process.exit(2);
}

if (MODE === "create") {
  const liveOk = args.has("--allow-live") && process.env.DODO_ALLOW_LIVE_WRITES === "1";
  if (ENV !== "test_mode" && !liveOk) {
    console.error(
      `Refusing --create: DODO_PAYMENTS_ENVIRONMENT="${ENV}" is not "test_mode".\n` +
        `Deploy 0 only creates products in Test Mode. To override (NOT for Deploy 0):\n` +
        `  --allow-live AND DODO_ALLOW_LIVE_WRITES=1`,
    );
    process.exit(2);
  }
}

const client =
  MODE === "catalog"
    ? (null as unknown as DodoPayments)
    : new DodoPayments({
        bearerToken: process.env.DODO_PAYMENTS_API_KEY,
        environment: ENV as "test_mode" | "live_mode",
      });

// ── helpers ────────────────────────────────────────────────────────────────

interface DodoProductLite {
  product_id: string;
  name?: string | null;
  is_recurring?: boolean;
  tax_category?: string | null;
  metadata?: Record<string, unknown> | null;
  // list() returns price as a number + price_detail as the object;
  // retrieve() returns price as the object. Handle both.
  price?: number | Record<string, unknown> | null;
  currency?: string | null;
  price_detail?: Record<string, unknown> | null;
}

/** The recurring-price object, whether the product came from list() or retrieve(). */
function priceDetailOf(p: DodoProductLite): Record<string, unknown> {
  if (p.price && typeof p.price === "object") return p.price as Record<string, unknown>;
  if (p.price_detail && typeof p.price_detail === "object") return p.price_detail;
  return {};
}

async function listAllProducts(): Promise<DodoProductLite[]> {
  const out: DodoProductLite[] = [];
  // recurring: true → only subscription products
  for await (const p of client.products.list({ recurring: true } as never)) {
    out.push(p as unknown as DodoProductLite);
  }
  return out;
}

function isConvrs(p: DodoProductLite): boolean {
  return (p.metadata as Record<string, unknown> | null)?.app === "convrs";
}

function priceObjFor(spec: DodoProductSpec) {
  return {
    type: "recurring_price" as const,
    currency: CURRENCY,
    discount: DISCOUNT,
    price: spec.priceCents,
    payment_frequency_count: 1,
    payment_frequency_interval: spec.paymentFrequencyInterval, // Month | Year
    // Term must be strictly longer than the payment frequency, else Dodo
    // expires the subscription after one cycle. 20 Year for every product.
    subscription_period_count: SUBSCRIPTION_PERIOD_COUNT,
    subscription_period_interval: SUBSCRIPTION_PERIOD_INTERVAL,
    tax_inclusive: TAX_INCLUSIVE,
    purchasing_power_parity: PURCHASING_POWER_PARITY,
    trial_period_days: TRIAL_PERIOD_DAYS, // 0 — trial is injected per-checkout
  };
}

interface FieldCheck {
  field: string;
  expected: unknown;
  actual: unknown;
  ok: boolean;
}

function verifyProduct(spec: DodoProductSpec, p: DodoProductLite): FieldCheck[] {
  const pd = priceDetailOf(p);
  const md = (p.metadata ?? {}) as Record<string, unknown>;
  const checks: FieldCheck[] = [];
  const cmp = (field: string, expected: unknown, actual: unknown) =>
    checks.push({ field, expected, actual, ok: expected === actual });

  cmp("name", spec.name, p.name ?? null);
  cmp("is_recurring", true, p.is_recurring ?? false);
  cmp("tax_category", TAX_CATEGORY, p.tax_category ?? null);
  cmp("price.type", "recurring_price", pd.type);
  cmp("price.currency", CURRENCY, pd.currency);
  cmp("price.price(cents)", spec.priceCents, pd.price);
  cmp("price.discount", DISCOUNT, pd.discount);
  cmp("price.tax_inclusive", TAX_INCLUSIVE, pd.tax_inclusive);
  cmp("price.payment_frequency_interval", spec.paymentFrequencyInterval, pd.payment_frequency_interval);
  cmp("price.payment_frequency_count", 1, pd.payment_frequency_count);
  cmp("price.subscription_period_interval", SUBSCRIPTION_PERIOD_INTERVAL, pd.subscription_period_interval);
  cmp("price.subscription_period_count", SUBSCRIPTION_PERIOD_COUNT, pd.subscription_period_count);
  cmp("price.trial_period_days", TRIAL_PERIOD_DAYS, pd.trial_period_days ?? 0);
  cmp("metadata.app", "convrs", md.app);
  cmp("metadata.plan_schema", spec.metadata.plan_schema, md.plan_schema);
  cmp("metadata.family", spec.family, md.family);
  cmp("metadata.tier", spec.tier, md.tier);
  cmp("metadata.interval", spec.interval, md.interval);
  cmp("metadata.max_workspaces", spec.metadata.max_workspaces, md.max_workspaces);
  cmp("metadata.events_included", spec.metadata.events_included, md.events_included);
  cmp("metadata.spec_key", spec.key, md.spec_key);
  return checks;
}

// ── modes ──────────────────────────────────────────────────────────────────

async function runList() {
  const all = await listAllProducts();
  const convrs = all.filter(isConvrs);
  console.log(`Dodo environment: ${ENV}`);
  console.log(`Recurring products total: ${all.length}  |  Convrs-tagged: ${convrs.length}\n`);

  if (args.has("--all")) {
    console.log("── all recurring products in this environment ──");
    for (const p of all) {
      const pd = (p.price_detail ?? {}) as Record<string, unknown>;
      const md = (p.metadata ?? {}) as Record<string, unknown>;
      console.log(
        `${p.product_id.padEnd(32)} ${String(pd.price ?? p.price ?? "?").toString().padStart(9)}c ` +
          `${String(pd.payment_frequency_interval ?? "?").padEnd(6)} app=${String(md.app ?? "-").padEnd(8)} ${p.name ?? ""}`,
      );
    }
    console.log("");
  }

  console.log("── Convrs-tagged recurring products ──");
  for (const p of convrs.sort((a, b) =>
    String((a.metadata as never)?.["spec_key"] ?? "").localeCompare(
      String((b.metadata as never)?.["spec_key"] ?? ""),
    ),
  )) {
    const md = p.metadata as Record<string, unknown>;
    const pd = (p.price_detail ?? {}) as Record<string, unknown>;
    console.log(
      `${String(md.spec_key ?? "(no spec_key)").padEnd(26)} ${p.product_id.padEnd(30)} ` +
        `${String(pd.price ?? p.price ?? "?").toString().padStart(8)}c ` +
        `${String(pd.payment_frequency_interval ?? "?").padEnd(6)} ${p.name ?? ""}`,
    );
  }
  if (convrs.length === 0) {
    console.log("(no Convrs-tagged recurring products found in this environment)");
  }
}

async function resolveExistingIds(): Promise<CreatedMap> {
  const created = loadCreated();
  const all = await listAllProducts();
  for (const p of all.filter(isConvrs)) {
    const key = (p.metadata as Record<string, unknown>)?.spec_key;
    if (typeof key === "string" && !created[key]) created[key] = p.product_id;
  }
  return created;
}

/**
 * Offline cross-check: the runtime pricing catalog (@repo/utils) must agree with
 * products-spec.ts and products.created.json on every one of the 36 products —
 * id, price, event allowance, and family workspace cap. Returns the failure
 * count (0 = all good).
 */
function runCatalog(): number {
  const created = loadCreated();
  const failures: string[] = [];

  // FAMILY_LIMITS parity
  for (const family of ["standard", "growth"] as const) {
    const expected = family === "growth" ? 30 : 1;
    if (FAMILY_LIMITS[family] !== expected) {
      failures.push(`FAMILY_LIMITS.${family}: catalog ${FAMILY_LIMITS[family]} != ${expected}`);
    }
  }

  for (const spec of PRODUCT_SPECS) {
    const catalogId = getProductIdByTier({
      family: spec.family,
      tier: spec.tier,
      interval: spec.interval,
    });
    const jsonId = created[spec.key];
    if (!catalogId) {
      failures.push(`${spec.key}: catalog has no product id`);
    } else if (jsonId && catalogId !== jsonId) {
      failures.push(`${spec.key}: catalog id ${catalogId} != ${basename(CREATED_PATH)} ${jsonId}`);
    }

    const plan = PRICING_FAMILIES[spec.family].find((p) => p.tier === spec.tier);
    if (!plan) {
      failures.push(`${spec.key}: catalog has no plan for tier ${spec.tier}`);
      continue;
    }
    const catalogPrice = spec.interval === "yearly" ? plan.price.yearly : plan.price.monthly;
    const approved = APPROVED_PRICING[spec.interval][spec.family][spec.tier];
    if (catalogPrice !== approved) {
      failures.push(`${spec.key}: catalog price ${catalogPrice} != approved ${approved}`);
    }

    const catalogEvents = TIER_EVENTS[spec.tier];
    // Must match pricing.tsx's UNCAPPED sentinel exactly (2_000_000_000, not
    // Number.MAX_SAFE_INTEGER — the latter overflows the Int32 tierEvents/
    // usageLimit columns; see pricing.tsx for the full explanation).
    const expectedEvents = spec.eventsIncluded ?? 2_000_000_000;
    if (catalogEvents !== expectedEvents) {
      failures.push(`${spec.key}: catalog events ${catalogEvents} != spec ${expectedEvents}`);
    }
  }

  if (failures.length) {
    console.log("── catalog cross-check: FAIL ──");
    for (const f of failures) console.log(`  ${f}`);
  } else {
    console.log(
      `── catalog cross-check: PASS ── @repo/utils == products-spec.ts == ${basename(CREATED_PATH)} (${PRODUCT_SPECS.length} products)`,
    );
  }
  return failures.length;
}

async function runVerify() {
  if (runCatalog() > 0) {
    console.log("\nAborting --verify: fix the pricing.tsx / products-spec.ts mismatch first.");
    process.exit(1);
  }
  console.log("");
  const ids = await resolveExistingIds();
  let pass = 0;
  const failures: string[] = [];
  const missing: string[] = [];

  for (const spec of PRODUCT_SPECS) {
    const id = ids[spec.key];
    if (!id) {
      missing.push(spec.key);
      continue;
    }
    const p = (await client.products.retrieve(id)) as unknown as DodoProductLite;
    const checks = verifyProduct(spec, p);
    const bad = checks.filter((c) => !c.ok);
    if (bad.length === 0) {
      pass++;
      console.log(`PASS  ${spec.key.padEnd(26)} ${id}`);
    } else {
      failures.push(spec.key);
      console.log(`FAIL  ${spec.key.padEnd(26)} ${id}`);
      for (const b of bad) {
        console.log(`        ${b.field}: expected ${JSON.stringify(b.expected)}, got ${JSON.stringify(b.actual)}`);
      }
    }
  }

  // orphan check
  const all = await listAllProducts();
  const specKeys = new Set(PRODUCT_SPECS.map((s) => s.key));
  const orphans = all
    .filter(isConvrs)
    .filter((p) => {
      const k = (p.metadata as Record<string, unknown>)?.spec_key;
      return typeof k !== "string" || !specKeys.has(k);
    })
    .map((p) => `${p.product_id} (${p.name ?? ""})`);

  console.log(`\n── summary (env: ${ENV}) ──`);
  console.log(`  spec products : ${PRODUCT_SPECS.length}`);
  console.log(`  verified PASS : ${pass}`);
  console.log(`  verified FAIL : ${failures.length}${failures.length ? "  " + failures.join(", ") : ""}`);
  console.log(`  MISSING       : ${missing.length}${missing.length ? "  " + missing.join(", ") : ""}`);
  console.log(`  orphan Convrs products: ${orphans.length}${orphans.length ? "\n    " + orphans.join("\n    ") : ""}`);

  if (failures.length || missing.length) process.exit(1);
  console.log("\nAll 36 products match products-spec.ts. ✅");
}

async function runCreate() {
  const created = await resolveExistingIds();
  let made = 0;
  let skipped = 0;

  for (const spec of PRODUCT_SPECS) {
    if (created[spec.key]) {
      skipped++;
      console.log(`skip   ${spec.key.padEnd(26)} exists ${created[spec.key]}`);
      continue;
    }
    const res = (await client.products.create({
      name: spec.name,
      price: priceObjFor(spec) as never,
      tax_category: TAX_CATEGORY,
      metadata: spec.metadata as never,
      description: `Convrs ${spec.family} plan, ${spec.eventsLabel} events/mo, billed ${spec.interval}. Managed by scripts/dodo/products-spec.ts — do not edit in the dashboard.`,
    })) as unknown as { product_id: string };

    created[spec.key] = res.product_id;
    saveCreated(created); // write after every create → resumable
    made++;
    console.log(`create ${spec.key.padEnd(26)} -> ${res.product_id}`);
  }

  console.log(`\n── created ${made}, skipped ${skipped} (env: ${ENV}) ──`);
  console.log(`ids written to ${CREATED_PATH}`);
  console.log(`next: run --verify`);
}

(async () => {
  if (MODE === "list") await runList();
  else if (MODE === "create") await runCreate();
  else if (MODE === "catalog") process.exitCode = runCatalog() > 0 ? 1 : 0;
  else await runVerify();
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

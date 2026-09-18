import { describe, it, expect } from "vitest";
import { tokenHasScope, RESOURCE_SCOPES } from "./scopes";

describe("tokenHasScope", () => {
  it("matches an exact scope", () => {
    expect(tokenHasScope(["analytics.read"], "analytics.read")).toBe(true);
  });

  it("rejects when the scope is absent", () => {
    expect(tokenHasScope(["websites.read"], "analytics.read")).toBe(false);
  });

  it("rejects a token with no scopes at all", () => {
    expect(tokenHasScope([], "analytics.read")).toBe(false);
  });

  it("apis.all satisfies any required scope", () => {
    expect(tokenHasScope(["apis.all"], "analytics.read")).toBe(true);
    expect(tokenHasScope(["apis.all"], "websites.read")).toBe(true);
  });

  it("apis.read satisfies any *.read scope but not a write scope", () => {
    expect(tokenHasScope(["apis.read"], "analytics.read")).toBe(true);
    expect(tokenHasScope(["apis.read"], "workspace.write")).toBe(false);
  });
});

describe("RESOURCE_SCOPES webhooks metadata (cleanup only — not consulted by tokenHasScope)", () => {
  it("maps webhooks.read/write to the webhooks permission, not tokens.read/write", () => {
    const read = RESOURCE_SCOPES.find((e) => e.scope.includes("webhooks.read"));
    const write = RESOURCE_SCOPES.find((e) => e.scope.includes("webhooks.write"));

    expect(read?.permission).toEqual(["webhooks.read"]);
    expect(write?.permission).toEqual(["webhooks.write"]);
    expect(read?.permission).not.toContain("tokens.read");
    expect(write?.permission).not.toContain("tokens.write");
  });
});

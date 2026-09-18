import { describe, it, expect } from "vitest";
import { checkWebsiteScope, toPublicWebsite } from "./website";

const workspace: any = {
  id: "abc123",
  name: "Acme",
  domain: "acme.com",
  timezone: "UTC",
  currency: "USD",
  createdAt: new Date("2026-01-01"),
  plan: "free",
  planFamily: "standard",
  subscriptionStatus: "active",
  cookielessMode: false,
};

describe("checkWebsiteScope (IDOR boundary)", () => {
  it("allows when no websiteId is requested", () => {
    expect(checkWebsiteScope(workspace, undefined)).toBeNull();
  });

  it("allows when the requested websiteId matches, with or without ws_ prefix", () => {
    expect(checkWebsiteScope(workspace, "abc123")).toBeNull();
    expect(checkWebsiteScope(workspace, "ws_abc123")).toBeNull();
  });

  it("rejects a websiteId belonging to a different workspace", async () => {
    const res = checkWebsiteScope(workspace, "someone-elses-workspace");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error.code).toBe("forbidden");
  });

  it("rejects a made-up / guessed websiteId (IDOR attempt)", async () => {
    const res = checkWebsiteScope(workspace, "ws_00000000000000");
    expect(res!.status).toBe(403);
  });
});

describe("toPublicWebsite", () => {
  it("only exposes real Workspace fields, prefixed id", () => {
    const pub = toPublicWebsite(workspace);
    expect(pub.id).toBe("ws_abc123");
    expect(pub.domain).toBe("acme.com");
    expect(pub.status).toBe("active");
    expect((pub as any).dodoCustomerId).toBeUndefined();
    expect((pub as any).ssoEmailDomain).toBeUndefined();
  });
});

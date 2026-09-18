import { describe, it, expect } from "vitest";
import { isAutoTrialEligible } from "./auto-trial";

describe("isAutoTrialEligible", () => {
  it("new user + first owned workspace + no subscription -> eligible", () => {
    expect(
      isAutoTrialEligible({
        freeTrialUsedAt: null,
        priorOwnedWorkspaceCount: 0,
        hasExistingSubscription: false,
      }),
    ).toBe(true);
  });

  it("new user + second owned workspace -> not eligible (priorOwnedWorkspaceCount > 0)", () => {
    expect(
      isAutoTrialEligible({
        freeTrialUsedAt: null,
        priorOwnedWorkspaceCount: 1,
        hasExistingSubscription: false,
      }),
    ).toBe(false);
  });

  it("existing user (already used trial) + new workspace -> not eligible", () => {
    expect(
      isAutoTrialEligible({
        freeTrialUsedAt: new Date("2026-01-01"),
        priorOwnedWorkspaceCount: 0,
        hasExistingSubscription: false,
      }),
    ).toBe(false);
  });

  it("user with an existing subscription + new workspace -> not eligible", () => {
    expect(
      isAutoTrialEligible({
        freeTrialUsedAt: null,
        priorOwnedWorkspaceCount: 0,
        hasExistingSubscription: true,
      }),
    ).toBe(false);
  });

  it("being a member/invitee of another workspace does NOT count as having created one -> still eligible", () => {
    // priorOwnedWorkspaceCount only counts WorkspaceUsers rows with
    // role: "owner". A user who was invited into someone else's workspace
    // (role: member/viewer/billing) has priorOwnedWorkspaceCount === 0 the
    // first time they create their own workspace, so they're still eligible.
    expect(
      isAutoTrialEligible({
        freeTrialUsedAt: null,
        priorOwnedWorkspaceCount: 0,
        hasExistingSubscription: false,
      }),
    ).toBe(true);
  });

  it("all three disqualifying conditions at once -> not eligible", () => {
    expect(
      isAutoTrialEligible({
        freeTrialUsedAt: new Date(),
        priorOwnedWorkspaceCount: 3,
        hasExistingSubscription: true,
      }),
    ).toBe(false);
  });
});

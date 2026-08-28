import { describe, expect, it, vi } from "vitest";
import type { OnboardingAcceptanceRecord } from "@/src/repositories/onboarding-repository";
import {
  acceptCurrentOnboardingWithDeps,
  getCurrentOnboardingStateWithDeps,
  isCurrentOnboardingCompleteWithDeps,
  type OnboardingServiceDeps,
} from "./onboarding-service";

const currentPolicies = {
  termsVersion: "terms-v2",
  privacyVersion: "privacy-v3",
};
const acceptedAt = new Date("2026-08-28T01:02:03.000Z");

function acceptance(
  overrides: Partial<OnboardingAcceptanceRecord> = {},
): OnboardingAcceptanceRecord {
  return {
    id: "acceptance-1",
    userId: "user-a",
    age14ConfirmedAt: acceptedAt,
    termsVersion: currentPolicies.termsVersion,
    termsAcceptedAt: acceptedAt,
    privacyVersion: currentPolicies.privacyVersion,
    privacyAcceptedAt: acceptedAt,
    createdAt: acceptedAt,
    ...overrides,
  };
}

function deps(overrides: Partial<OnboardingServiceDeps> = {}): OnboardingServiceDeps {
  return {
    findCurrent: vi.fn(async () => null),
    ensureCurrent: vi.fn(async (input) =>
      acceptance({
        userId: input.ownerUserId,
        termsVersion: input.termsVersion,
        privacyVersion: input.privacyVersion,
        age14ConfirmedAt: input.acceptedAt,
        termsAcceptedAt: input.acceptedAt,
        privacyAcceptedAt: input.acceptedAt,
        createdAt: input.acceptedAt,
      }),
    ),
    getPolicies: vi.fn(() => currentPolicies),
    ...overrides,
  };
}

describe("onboarding completion service", () => {
  it("returns complete only for the exact current version snapshot", async () => {
    const adapter = deps({ findCurrent: vi.fn(async () => acceptance()) });
    await expect(
      getCurrentOnboardingStateWithDeps(
        { ownerUserId: "user-a", currentPolicies },
        adapter,
      ),
    ).resolves.toEqual({
      complete: true,
      age14Confirmed: true,
      terms: {
        currentVersion: "terms-v2",
        accepted: true,
        acceptedAt: acceptedAt.toISOString(),
      },
      privacy: {
        currentVersion: "privacy-v3",
        accepted: true,
        acceptedAt: acceptedAt.toISOString(),
      },
    });
  });

  it("returns incomplete when no exact current snapshot exists", async () => {
    const adapter = deps();
    await expect(
      getCurrentOnboardingStateWithDeps(
        { ownerUserId: "user-a", currentPolicies },
        adapter,
      ),
    ).resolves.toEqual({
      complete: false,
      age14Confirmed: false,
      terms: { currentVersion: "terms-v2", accepted: false, acceptedAt: null },
      privacy: { currentVersion: "privacy-v3", accepted: false, acceptedAt: null },
    });
  });

  it("asks the repository for current versions rather than accepting an old Terms snapshot", async () => {
    const findCurrent = vi.fn(async () => null);
    const adapter = deps({ findCurrent });
    await getCurrentOnboardingStateWithDeps(
      { ownerUserId: "user-a", currentPolicies },
      adapter,
    );
    expect(findCurrent).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      termsVersion: "terms-v2",
      privacyVersion: "privacy-v3",
    });
  });

  it("uses one server timestamp for all acceptance timestamps", async () => {
    const ensureCurrent = vi.fn(async (input) => acceptance({
      userId: input.ownerUserId,
      termsVersion: input.termsVersion,
      privacyVersion: input.privacyVersion,
      age14ConfirmedAt: input.acceptedAt,
      termsAcceptedAt: input.acceptedAt,
      privacyAcceptedAt: input.acceptedAt,
      createdAt: input.acceptedAt,
    }));
    const adapter = deps({ ensureCurrent });

    const state = await acceptCurrentOnboardingWithDeps(
      { ownerUserId: "user-a", currentPolicies, now: acceptedAt },
      adapter,
    );

    expect(ensureCurrent).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      termsVersion: "terms-v2",
      privacyVersion: "privacy-v3",
      acceptedAt,
    });
    expect(state.complete).toBe(true);
  });

  it("repeated acceptance can resolve the same current snapshot", async () => {
    const existing = acceptance();
    const adapter = deps({ ensureCurrent: vi.fn(async () => existing) });
    await expect(
      acceptCurrentOnboardingWithDeps(
        { ownerUserId: "user-a", currentPolicies, now: acceptedAt },
        adapter,
      ),
    ).resolves.toMatchObject({ complete: true, age14Confirmed: true });
  });

  it("reuses production policy lookup for the completion helper", async () => {
    const adapter = deps({ findCurrent: vi.fn(async () => acceptance()) });
    await expect(isCurrentOnboardingCompleteWithDeps("user-a", adapter)).resolves.toBe(true);
    expect(adapter.getPolicies).toHaveBeenCalledOnce();
  });

  it("does not expose acceptance row or owner identifiers in state", async () => {
    const adapter = deps({ findCurrent: vi.fn(async () => acceptance()) });
    const state = await getCurrentOnboardingStateWithDeps(
      { ownerUserId: "user-a", currentPolicies },
      adapter,
    );
    expect(JSON.stringify(state)).not.toContain("acceptance-1");
    expect(JSON.stringify(state)).not.toContain("user-a");
  });
});

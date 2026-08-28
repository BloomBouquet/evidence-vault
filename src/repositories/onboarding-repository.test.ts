import { describe, expect, it, vi } from "vitest";
import {
  ensureCurrentAcceptanceWithStore,
  findCurrentAcceptanceWithStore,
  type OnboardingAcceptanceRecord,
  type OnboardingAcceptanceStore,
} from "./onboarding-repository";

const acceptedAt = new Date("2026-08-28T00:00:00.000Z");

function record(overrides: Partial<OnboardingAcceptanceRecord> = {}): OnboardingAcceptanceRecord {
  return {
    id: "acceptance-1",
    userId: "user-a",
    age14ConfirmedAt: acceptedAt,
    termsVersion: "terms-v1",
    termsAcceptedAt: acceptedAt,
    privacyVersion: "privacy-v1",
    privacyAcceptedAt: acceptedAt,
    createdAt: acceptedAt,
    ...overrides,
  };
}

function store(overrides: Partial<OnboardingAcceptanceStore> = {}): OnboardingAcceptanceStore {
  return {
    findCurrent: vi.fn(async () => null),
    insertCurrent: vi.fn(async (input) => record({
      userId: input.ownerUserId,
      age14ConfirmedAt: input.acceptedAt,
      termsVersion: input.termsVersion,
      termsAcceptedAt: input.acceptedAt,
      privacyVersion: input.privacyVersion,
      privacyAcceptedAt: input.acceptedAt,
      createdAt: input.acceptedAt,
    })),
    ...overrides,
  };
}

describe("onboarding repository", () => {
  it("looks up the exact owner and current policy-version pair", async () => {
    const current = record();
    const adapter = store({ findCurrent: vi.fn(async () => current) });

    await expect(
      findCurrentAcceptanceWithStore(adapter, {
        ownerUserId: "user-a",
        termsVersion: "terms-v1",
        privacyVersion: "privacy-v1",
      }),
    ).resolves.toEqual(current);

    expect(adapter.findCurrent).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
    });
  });

  it("returns null when the exact owner/version pair is missing", async () => {
    const adapter = store();
    await expect(
      findCurrentAcceptanceWithStore(adapter, {
        ownerUserId: "user-a",
        termsVersion: "terms-v2",
        privacyVersion: "privacy-v1",
      }),
    ).resolves.toBeNull();
  });

  it("inserts the authenticated owner and server versions with one acceptedAt", async () => {
    const adapter = store();
    const result = await ensureCurrentAcceptanceWithStore(adapter, {
      ownerUserId: "user-a",
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
      acceptedAt,
    });

    expect(result.userId).toBe("user-a");
    expect(adapter.insertCurrent).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
      acceptedAt,
    });
  });

  it("re-reads the exact pair when a concurrent insert already won", async () => {
    const existing = record();
    const adapter = store({
      insertCurrent: vi.fn(async () => null),
      findCurrent: vi.fn(async () => existing),
    });

    await expect(
      ensureCurrentAcceptanceWithStore(adapter, {
        ownerUserId: "user-a",
        termsVersion: "terms-v1",
        privacyVersion: "privacy-v1",
        acceptedAt,
      }),
    ).resolves.toEqual(existing);

    expect(adapter.findCurrent).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
    });
  });
});

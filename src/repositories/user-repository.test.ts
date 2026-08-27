import { describe, expect, it, vi } from "vitest";
import { upsertUserIdentity, type UserIdentityStore } from "./user-repository";

function store(overrides: Partial<UserIdentityStore> = {}): UserIdentityStore {
  return {
    findBySubject: vi.fn(async () => null),
    insertUser: vi.fn(async (input) => ({ id: "new-id", ...input, deletedAt: null })),
    updateDisplayName: vi.fn(async (id, displayName) => ({
      id,
      identitySubject: "subject-1",
      displayName,
      deletedAt: null,
    })),
    ...overrides,
  };
}

describe("upsertUserIdentity", () => {
  it("creates a minimal local identity when the subject is new", async () => {
    const adapter = store();
    await expect(
      upsertUserIdentity(adapter, { identitySubject: "subject-1", displayName: "순우" }),
    ).resolves.toEqual({ id: "new-id", identitySubject: "subject-1", displayName: "순우" });
    expect(adapter.insertUser).toHaveBeenCalledWith({ identitySubject: "subject-1", displayName: "순우" });
  });

  it("updates only the display name for an active identity", async () => {
    const adapter = store({
      findBySubject: vi.fn(async () => ({
        id: "existing-id",
        identitySubject: "subject-1",
        displayName: "Old Name",
        deletedAt: null,
      })),
    });
    await expect(
      upsertUserIdentity(adapter, { identitySubject: "subject-1", displayName: "New Name" }),
    ).resolves.toEqual({ id: "existing-id", identitySubject: "subject-1", displayName: "New Name" });
    expect(adapter.updateDisplayName).toHaveBeenCalledWith("existing-id", "New Name");
    expect(adapter.insertUser).not.toHaveBeenCalled();
  });

  it("rejects a deleted local account without reactivating it", async () => {
    const adapter = store({
      findBySubject: vi.fn(async () => ({
        id: "deleted-id",
        identitySubject: "subject-1",
        displayName: "Deleted",
        deletedAt: new Date("2026-08-01T00:00:00Z"),
      })),
    });
    await expect(
      upsertUserIdentity(adapter, { identitySubject: "subject-1", displayName: "New Name" }),
    ).rejects.toThrow("account_deleted");
    expect(adapter.updateDisplayName).not.toHaveBeenCalled();
    expect(adapter.insertUser).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  createEvidenceFileWithStore,
  getEvidenceFileWithStore,
  getOwnedEvidenceFileWithStore,
  markEvidenceFileDeletedWithStore,
  type EvidenceFileStore,
} from "./evidence-repository";

const row = {
  id: "file-1",
  userId: "user-a",
  vaultItemId: "vault-1",
  evidenceEventId: null,
  storageKey: "users/user-a/evidence/file-1",
  originalFilename: "receipt.pdf",
  mimeType: "application/pdf",
  byteSize: 3,
  sha256: "a".repeat(64),
  redactionState: "unreviewed",
  uploadedAt: new Date("2026-08-28T00:00:00.000Z"),
  deletedAt: null,
};

function store(): EvidenceFileStore {
  return {
    getOwned: vi.fn(async (ownerUserId, id) =>
      ownerUserId === "user-a" && id === "file-1" ? row : null,
    ),
    getActive: vi.fn(async (ownerUserId, id) =>
      ownerUserId === "user-a" && id === "file-1" ? row : null,
    ),
    create: vi.fn(async (input) => ({ ...row, ...input })),
    markDeleted: vi.fn(async (ownerUserId, id, deletedAt) =>
      ownerUserId === "user-a" && id === "file-1" ? { ...row, deletedAt } : null,
    ),
  };
}

describe("evidence repository ownership", () => {
  it("uses owner scope for active file lookup", async () => {
    const fake = store();
    await expect(getEvidenceFileWithStore(fake, { ownerUserId: "user-a", id: "file-1" })).resolves.toEqual(row);
    await expect(getEvidenceFileWithStore(fake, { ownerUserId: "user-b", id: "file-1" })).resolves.toBeNull();
    expect(fake.getActive).toHaveBeenCalledWith("user-b", "file-1");
  });

  it("can owner-scope a revoked file for idempotent deletion without making it downloadable", async () => {
    const fake = store();
    const revoked = { ...row, deletedAt: new Date("2026-08-28T03:00:00.000Z") };
    vi.mocked(fake.getOwned).mockResolvedValueOnce(revoked);

    await expect(getOwnedEvidenceFileWithStore(fake, { ownerUserId: "user-a", id: "file-1" })).resolves.toEqual(revoked);
    expect(fake.getOwned).toHaveBeenCalledWith("user-a", "file-1");
  });

  it("persists exact server metadata on create", async () => {
    const fake = store();
    const input = {
      id: "file-1",
      userId: "user-a",
      vaultItemId: "vault-1",
      evidenceEventId: null,
      storageKey: "users/user-a/evidence/file-1",
      originalFilename: "receipt.pdf",
      mimeType: "application/pdf",
      byteSize: 3,
      sha256: "a".repeat(64),
      redactionState: "unreviewed",
    };

    await createEvidenceFileWithStore(fake, input);
    expect(fake.create).toHaveBeenCalledWith(input);
  });

  it("marks only an owner-scoped active file deleted and is idempotent to missing rows", async () => {
    const fake = store();
    const deletedAt = new Date("2026-08-28T03:00:00.000Z");
    await expect(markEvidenceFileDeletedWithStore(fake, { ownerUserId: "user-a", id: "file-1", deletedAt })).resolves.toMatchObject({ deletedAt });
    await expect(markEvidenceFileDeletedWithStore(fake, { ownerUserId: "user-b", id: "file-1", deletedAt })).resolves.toBeNull();
  });
});

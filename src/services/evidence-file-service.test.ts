import { describe, expect, it, vi } from "vitest";
import { StorageOperationError } from "@/src/storage/errors";
import type { EvidenceStorage } from "@/src/storage/types";
import {
  EvidenceServiceError,
  uploadEvidenceFile,
  type EvidenceFileServiceDeps,
} from "./evidence-file-service";

const bytes = new TextEncoder().encode("evidence");

function deps(overrides: Partial<EvidenceFileServiceDeps> = {}): EvidenceFileServiceDeps {
  const storage: EvidenceStorage = {
    putObject: vi.fn(async () => undefined),
    deleteObject: vi.fn(async () => undefined),
    getDownloadTarget: vi.fn(async () => ({ kind: "bytes" as const, bytes })),
  };

  return {
    ownsVault: vi.fn(async () => true),
    ownsEvent: vi.fn(async () => true),
    storage,
    createEvidence: vi.fn(async (input) => ({
      ...input,
      uploadedAt: new Date("2026-08-28T00:00:00.000Z"),
      deletedAt: null,
    })),
    createDeletionJob: vi.fn(async () => undefined),
    idFactory: () => "22222222-2222-4222-8222-222222222222",
    jobIdFactory: () => "33333333-3333-4333-8333-333333333333",
    ...overrides,
  };
}

const input = {
  ownerUserId: "11111111-1111-4111-8111-111111111111",
  vaultItemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  evidenceEventId: null,
  filename: "receipt.pdf",
  mimeType: "application/pdf",
  bytes,
};

describe("uploadEvidenceFile", () => {
  it("stores exact bytes and persists the server hash/key without exposing them in the DTO", async () => {
    const fake = deps();
    await expect(uploadEvidenceFile(input, fake)).resolves.toEqual({
      id: "22222222-2222-4222-8222-222222222222",
      vaultItemId: input.vaultItemId,
      evidenceEventId: null,
      originalFilename: "receipt.pdf",
      mimeType: "application/pdf",
      byteSize: 8,
      sha256: "ee8250fb76e094b34b471f13a73dbbe51d1ae142e9df59d7c0d31ec20f0a0a8e",
      redactionState: "unreviewed",
    });

    expect(fake.storage.putObject).toHaveBeenCalledWith({
      storageKey: "users/11111111-1111-4111-8111-111111111111/evidence/22222222-2222-4222-8222-222222222222",
      bytes,
      mimeType: "application/pdf",
    });
    expect(fake.createEvidence).toHaveBeenCalledWith(expect.objectContaining({
      userId: input.ownerUserId,
      storageKey: "users/11111111-1111-4111-8111-111111111111/evidence/22222222-2222-4222-8222-222222222222",
      sha256: "ee8250fb76e094b34b471f13a73dbbe51d1ae142e9df59d7c0d31ec20f0a0a8e",
    }));
  });

  it("returns not-found before storage for foreign vaults or mismatched events", async () => {
    const foreignVault = deps({ ownsVault: vi.fn(async () => false) });
    await expect(uploadEvidenceFile(input, foreignVault)).rejects.toMatchObject({ code: "not_found" });
    expect(foreignVault.storage.putObject).not.toHaveBeenCalled();

    const wrongEvent = deps({ ownsEvent: vi.fn(async () => false) });
    await expect(uploadEvidenceFile({ ...input, evidenceEventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, wrongEvent)).rejects.toMatchObject({ code: "not_found" });
    expect(wrongEvent.storage.putObject).not.toHaveBeenCalled();
  });

  it("does not persist metadata when object storage fails", async () => {
    const fake = deps();
    vi.mocked(fake.storage.putObject).mockRejectedValueOnce(new StorageOperationError("transient"));

    await expect(uploadEvidenceFile(input, fake)).rejects.toMatchObject({ code: "storage_unavailable" });
    expect(fake.createEvidence).not.toHaveBeenCalled();
  });

  it("compensates the object when metadata persistence fails", async () => {
    const fake = deps({ createEvidence: vi.fn(async () => { throw new Error("db_down"); }) });

    await expect(uploadEvidenceFile(input, fake)).rejects.toBeInstanceOf(EvidenceServiceError);
    expect(fake.storage.deleteObject).toHaveBeenCalledWith(
      "users/11111111-1111-4111-8111-111111111111/evidence/22222222-2222-4222-8222-222222222222",
    );
    expect(fake.createDeletionJob).not.toHaveBeenCalled();
  });

  it("queues reconciliation when metadata persistence and compensating delete both fail", async () => {
    const fake = deps({ createEvidence: vi.fn(async () => { throw new Error("db_down"); }) });
    vi.mocked(fake.storage.deleteObject).mockRejectedValueOnce(new StorageOperationError("transient"));

    await expect(uploadEvidenceFile(input, fake)).rejects.toMatchObject({ code: "storage_unavailable" });
    expect(fake.createDeletionJob).toHaveBeenCalledWith({
      id: "33333333-3333-4333-8333-333333333333",
      userId: input.ownerUserId,
      kind: "evidence_file_object",
      targetId: "22222222-2222-4222-8222-222222222222",
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  getEvidenceDownload,
  uploadEvidenceFile,
  type EvidenceDownloadServiceDeps,
  type EvidenceFileServiceDeps,
} from "@/src/services/evidence-file-service";
import {
  requestEvidenceDeletion,
  type DeletionReconciliationDeps,
} from "@/src/services/deletion-reconciliation";
import type { EvidenceStorage } from "@/src/storage/types";

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const vaultB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const fileB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const jobId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function storage(): EvidenceStorage {
  return {
    putObject: vi.fn(async () => undefined),
    deleteObject: vi.fn(async () => undefined),
    getDownloadTarget: vi.fn(async () => ({
      kind: "redirect" as const,
      url: "https://signed.example/private?secret=1",
      expiresAt: new Date("2026-08-28T05:05:00.000Z"),
    })),
  };
}

describe("evidence storage owner isolation", () => {
  it("does not let user A upload into user B's vault before any object write", async () => {
    const privateStorage = storage();
    const deps: EvidenceFileServiceDeps = {
      ownsVault: vi.fn(async (ownerUserId, vaultItemId) => ownerUserId === userB && vaultItemId === vaultB),
      ownsEvent: vi.fn(async () => true),
      storage: privateStorage,
      createEvidence: vi.fn(async () => undefined),
      createDeletionJob: vi.fn(async () => undefined),
      idFactory: () => fileB,
      jobIdFactory: () => jobId,
    };

    await expect(uploadEvidenceFile({
      ownerUserId: userA,
      vaultItemId: vaultB,
      evidenceEventId: null,
      filename: "receipt.pdf",
      mimeType: "application/pdf",
      bytes: new TextEncoder().encode("evidence"),
    }, deps)).rejects.toMatchObject({ code: "not_found" });
    expect(privateStorage.putObject).not.toHaveBeenCalled();
  });

  it("gives foreign and missing downloads the same not-found result without signing storage access", async () => {
    const privateStorage = storage();
    const deps: EvidenceDownloadServiceDeps = {
      getEvidence: vi.fn(async ({ ownerUserId, id }) =>
        ownerUserId === userB && id === fileB
          ? { storageKey: `users/${userB}/evidence/${fileB}`, originalFilename: "receipt.pdf", mimeType: "application/pdf" }
          : null,
      ),
      storage: privateStorage,
    };

    const foreign = getEvidenceDownload({ ownerUserId: userA, evidenceFileId: fileB }, deps);
    const missing = getEvidenceDownload({ ownerUserId: userA, evidenceFileId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }, deps);

    await expect(foreign).rejects.toMatchObject({ code: "not_found" });
    await expect(missing).rejects.toMatchObject({ code: "not_found" });
    expect(privateStorage.getDownloadTarget).not.toHaveBeenCalled();
  });

  it("revokes an owned file before returning accepted so later downloads cannot reach storage", async () => {
    const privateStorage = storage();
    let deletedAt: Date | null = null;
    const deletionJob = {
      id: jobId,
      userId: userB,
      kind: "evidence_file_object",
      targetId: fileB,
      status: "queued",
      attempts: 0,
      lastErrorCode: null,
    };
    const deletionDeps: DeletionReconciliationDeps = {
      getEvidence: vi.fn(async ({ ownerUserId, id }) =>
        ownerUserId === userB && id === fileB ? { id: fileB, userId: userB, deletedAt } : null,
      ),
      markDeleted: vi.fn(async ({ ownerUserId, id, deletedAt: nextDeletedAt }) => {
        if (ownerUserId !== userB || id !== fileB) return null;
        deletedAt = nextDeletedAt;
        return { id: fileB, userId: userB, deletedAt };
      }),
      ensureDeletionJob: vi.fn(async () => deletionJob),
      getDeletionJob: vi.fn(async () => deletionJob),
      markCompleted: vi.fn(async () => deletionJob),
      markQueued: vi.fn(async () => deletionJob),
      markBlocked: vi.fn(async () => deletionJob),
      storage: privateStorage,
      idFactory: () => jobId,
      now: () => new Date("2026-08-28T05:00:00.000Z"),
    };

    await expect(requestEvidenceDeletion({ ownerUserId: userB, evidenceFileId: fileB }, deletionDeps)).resolves.toEqual({ status: "accepted" });
    expect(deletedAt).not.toBeNull();

    const downloadDeps: EvidenceDownloadServiceDeps = {
      getEvidence: vi.fn(async ({ ownerUserId, id }) =>
        ownerUserId === userB && id === fileB && !deletedAt
          ? { storageKey: `users/${userB}/evidence/${fileB}`, originalFilename: "receipt.pdf", mimeType: "application/pdf" }
          : null,
      ),
      storage: privateStorage,
    };

    await expect(getEvidenceDownload({ ownerUserId: userB, evidenceFileId: fileB }, downloadDeps)).rejects.toMatchObject({ code: "not_found" });
    expect(privateStorage.getDownloadTarget).not.toHaveBeenCalled();
  });

  it("does not let user A delete user B's evidence and matches the missing-file error", async () => {
    const privateStorage = storage();
    const baseJob = {
      id: jobId,
      userId: userB,
      kind: "evidence_file_object",
      targetId: fileB,
      status: "queued",
      attempts: 0,
      lastErrorCode: null,
    };
    const deps: DeletionReconciliationDeps = {
      getEvidence: vi.fn(async ({ ownerUserId, id }) =>
        ownerUserId === userB && id === fileB ? { id: fileB, userId: userB, deletedAt: null } : null,
      ),
      markDeleted: vi.fn(async () => null),
      ensureDeletionJob: vi.fn(async () => baseJob),
      getDeletionJob: vi.fn(async () => baseJob),
      markCompleted: vi.fn(async () => baseJob),
      markQueued: vi.fn(async () => baseJob),
      markBlocked: vi.fn(async () => baseJob),
      storage: privateStorage,
      idFactory: () => jobId,
      now: () => new Date("2026-08-28T05:00:00.000Z"),
    };

    const foreign = requestEvidenceDeletion({ ownerUserId: userA, evidenceFileId: fileB }, deps);
    const missing = requestEvidenceDeletion({ ownerUserId: userA, evidenceFileId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }, deps);

    await expect(foreign).rejects.toMatchObject({ code: "not_found" });
    await expect(missing).rejects.toMatchObject({ code: "not_found" });
    expect(deps.markDeleted).not.toHaveBeenCalled();
    expect(deps.ensureDeletionJob).not.toHaveBeenCalled();
    expect(privateStorage.deleteObject).not.toHaveBeenCalled();
  });
});

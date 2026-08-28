import { describe, expect, it, vi } from "vitest";
import { StorageOperationError } from "@/src/storage/errors";
import {
  DeletionServiceError,
  processDeletionJob,
  requestEvidenceDeletion,
  type DeletionReconciliationDeps,
} from "./deletion-reconciliation";

const ownerUserId = "11111111-1111-4111-8111-111111111111";
const evidenceFileId = "22222222-2222-4222-8222-222222222222";
const deletedAt = new Date("2026-08-28T04:30:00.000Z");
const evidence = {
  id: evidenceFileId,
  userId: ownerUserId,
  deletedAt: null as Date | null,
};
const job = {
  id: "33333333-3333-4333-8333-333333333333",
  userId: ownerUserId,
  kind: "evidence_file_object",
  targetId: evidenceFileId,
  status: "queued",
  attempts: 0,
  lastErrorCode: null as string | null,
};

function deps(overrides: Partial<DeletionReconciliationDeps> = {}): DeletionReconciliationDeps {
  return {
    getEvidence: vi.fn(async () => evidence),
    markDeleted: vi.fn(async () => ({ ...evidence, deletedAt })),
    ensureDeletionJob: vi.fn(async () => job),
    getDeletionJob: vi.fn(async () => job),
    markCompleted: vi.fn(async (_id, attempts) => ({ ...job, status: "completed", attempts })),
    markQueued: vi.fn(async (_id, attempts, lastErrorCode) => ({ ...job, status: "queued", attempts, lastErrorCode })),
    markBlocked: vi.fn(async (_id, attempts, lastErrorCode) => ({ ...job, status: "blocked", attempts, lastErrorCode })),
    storage: {
      putObject: vi.fn(async () => undefined),
      getDownloadTarget: vi.fn(async () => ({ kind: "bytes" as const, bytes: new Uint8Array() })),
      deleteObject: vi.fn(async () => undefined),
    },
    idFactory: () => job.id,
    now: () => deletedAt,
    ...overrides,
  };
}

describe("requestEvidenceDeletion", () => {
  it("revokes an owned active file immediately and ensures one deterministic deletion job", async () => {
    const fake = deps();

    await expect(requestEvidenceDeletion({ ownerUserId, evidenceFileId }, fake)).resolves.toEqual({ status: "accepted" });
    expect(fake.markDeleted).toHaveBeenCalledWith({ ownerUserId, id: evidenceFileId, deletedAt });
    expect(fake.ensureDeletionJob).toHaveBeenCalledWith({
      id: job.id,
      userId: ownerUserId,
      kind: "evidence_file_object",
      targetId: evidenceFileId,
    });
  });

  it("is idempotent for an already revoked owned file without marking it deleted twice", async () => {
    const fake = deps({ getEvidence: vi.fn(async () => ({ ...evidence, deletedAt })) });

    await expect(requestEvidenceDeletion({ ownerUserId, evidenceFileId }, fake)).resolves.toEqual({ status: "accepted" });
    expect(fake.markDeleted).not.toHaveBeenCalled();
    expect(fake.ensureDeletionJob).toHaveBeenCalledTimes(1);
  });

  it("returns the neutral not-found contract for missing or foreign files", async () => {
    const fake = deps({ getEvidence: vi.fn(async () => null) });

    await expect(requestEvidenceDeletion({ ownerUserId, evidenceFileId }, fake)).rejects.toEqual(
      new DeletionServiceError("not_found"),
    );
    expect(fake.markDeleted).not.toHaveBeenCalled();
    expect(fake.ensureDeletionJob).not.toHaveBeenCalled();
  });
});

describe("processDeletionJob", () => {
  it("physically deletes the deterministic object and completes the first attempt", async () => {
    const fake = deps();

    await processDeletionJob(job.id, fake);
    expect(fake.storage.deleteObject).toHaveBeenCalledWith(
      `users/${ownerUserId}/evidence/${evidenceFileId}`,
    );
    expect(fake.markCompleted).toHaveBeenCalledWith(job.id, 1);
  });

  it("treats provider not-found as terminal success", async () => {
    const fake = deps();
    vi.mocked(fake.storage.deleteObject).mockRejectedValueOnce(new StorageOperationError("not_found"));

    await processDeletionJob(job.id, fake);
    expect(fake.markCompleted).toHaveBeenCalledWith(job.id, 1);
  });

  it("requeues transient failures before the fifth attempt", async () => {
    const fake = deps({ getDeletionJob: vi.fn(async () => ({ ...job, attempts: 1 })) });
    vi.mocked(fake.storage.deleteObject).mockRejectedValueOnce(new StorageOperationError("transient"));

    await processDeletionJob(job.id, fake);
    expect(fake.markQueued).toHaveBeenCalledWith(job.id, 2, "storage_transient");
    expect(fake.markCompleted).not.toHaveBeenCalled();
  });

  it("blocks permanent failures immediately", async () => {
    const fake = deps();
    vi.mocked(fake.storage.deleteObject).mockRejectedValueOnce(new StorageOperationError("permanent"));

    await processDeletionJob(job.id, fake);
    expect(fake.markBlocked).toHaveBeenCalledWith(job.id, 1, "storage_permanent");
  });

  it("blocks the fifth transient failure instead of inventing success", async () => {
    const fake = deps({ getDeletionJob: vi.fn(async () => ({ ...job, attempts: 4 })) });
    vi.mocked(fake.storage.deleteObject).mockRejectedValueOnce(new StorageOperationError("transient"));

    await processDeletionJob(job.id, fake);
    expect(fake.markBlocked).toHaveBeenCalledWith(job.id, 5, "storage_transient");
    expect(fake.markCompleted).not.toHaveBeenCalled();
  });

  it.each(["completed", "blocked"])("does not process an already %s job", async (status) => {
    const fake = deps({ getDeletionJob: vi.fn(async () => ({ ...job, status })) });

    await processDeletionJob(job.id, fake);
    expect(fake.storage.deleteObject).not.toHaveBeenCalled();
    expect(fake.markCompleted).not.toHaveBeenCalled();
    expect(fake.markQueued).not.toHaveBeenCalled();
    expect(fake.markBlocked).not.toHaveBeenCalled();
  });
});

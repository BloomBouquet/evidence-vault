import { buildEvidenceStorageKey } from "@/src/storage/key";
import { normalizeStorageError } from "@/src/storage/errors";
import type { EvidenceStorage } from "@/src/storage/types";

export type DeletionServiceErrorCode = "not_found";

export class DeletionServiceError extends Error {
  constructor(readonly code: DeletionServiceErrorCode) {
    super(code);
    this.name = "DeletionServiceError";
  }
}

type EvidenceDeletionRow = {
  id: string;
  userId: string;
  deletedAt: Date | null;
};

type DeletionJob = {
  id: string;
  userId: string;
  kind: string;
  targetId: string;
  status: string;
  attempts: number;
  lastErrorCode: string | null;
};

export type DeletionReconciliationDeps = {
  getEvidence(input: { ownerUserId: string; id: string }): Promise<EvidenceDeletionRow | null>;
  markDeleted(input: {
    ownerUserId: string;
    id: string;
    deletedAt: Date;
  }): Promise<EvidenceDeletionRow | null>;
  ensureDeletionJob(input: {
    id: string;
    userId: string;
    kind: "evidence_file_object";
    targetId: string;
  }): Promise<DeletionJob>;
  getDeletionJob(id: string): Promise<DeletionJob | null>;
  markCompleted(id: string, attempts: number): Promise<DeletionJob | null>;
  markQueued(id: string, attempts: number, lastErrorCode: string): Promise<DeletionJob | null>;
  markBlocked(id: string, attempts: number, lastErrorCode: string): Promise<DeletionJob | null>;
  storage: EvidenceStorage;
  idFactory(): string;
  now(): Date;
};

export async function requestEvidenceDeletion(
  input: { ownerUserId: string; evidenceFileId: string },
  deps: DeletionReconciliationDeps,
) {
  const evidence = await deps.getEvidence({
    ownerUserId: input.ownerUserId,
    id: input.evidenceFileId,
  });
  if (!evidence) throw new DeletionServiceError("not_found");

  if (!evidence.deletedAt) {
    await deps.markDeleted({
      ownerUserId: input.ownerUserId,
      id: input.evidenceFileId,
      deletedAt: deps.now(),
    });
  }

  await deps.ensureDeletionJob({
    id: deps.idFactory(),
    userId: input.ownerUserId,
    kind: "evidence_file_object",
    targetId: input.evidenceFileId,
  });

  return { status: "accepted" as const };
}

export async function processDeletionJob(
  jobId: string,
  deps: DeletionReconciliationDeps,
) {
  const job = await deps.getDeletionJob(jobId);
  if (!job) throw new DeletionServiceError("not_found");
  if (job.status === "completed" || job.status === "blocked") return job;

  const attempts = job.attempts + 1;
  if (job.kind !== "evidence_file_object") {
    return deps.markBlocked(job.id, attempts, "deletion_kind_unsupported");
  }

  const storageKey = buildEvidenceStorageKey(job.userId, job.targetId);
  try {
    await deps.storage.deleteObject(storageKey);
  } catch (error) {
    const normalized = normalizeStorageError(error);
    if (normalized.category === "not_found") {
      return deps.markCompleted(job.id, attempts);
    }

    const errorCode = normalized.message;
    if (normalized.category === "permanent" || attempts >= 5) {
      return deps.markBlocked(job.id, attempts, errorCode);
    }

    return deps.markQueued(job.id, attempts, errorCode);
  }

  return deps.markCompleted(job.id, attempts);
}

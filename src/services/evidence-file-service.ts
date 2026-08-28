import { buildEvidenceStorageKey } from "@/src/storage/key";
import type { EvidenceStorage } from "@/src/storage/types";
import { sha256Hex, validateEvidenceUpload } from "@/src/storage/validation";

export type EvidenceServiceErrorCode =
  | "not_found"
  | "invalid_request"
  | "unsupported_file_type"
  | "file_too_large"
  | "storage_unavailable"
  | "metadata_persistence_failed";

export class EvidenceServiceError extends Error {
  constructor(readonly code: EvidenceServiceErrorCode) {
    super(code);
    this.name = "EvidenceServiceError";
  }
}

export type EvidenceFileDto = {
  id: string;
  vaultItemId: string;
  evidenceEventId: string | null;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  redactionState: string;
};

export type EvidenceFileServiceDeps = {
  ownsVault(ownerUserId: string, vaultItemId: string): Promise<boolean>;
  ownsEvent(
    ownerUserId: string,
    vaultItemId: string,
    evidenceEventId: string,
  ): Promise<boolean>;
  storage: EvidenceStorage;
  createEvidence(input: {
    id: string;
    userId: string;
    vaultItemId: string;
    evidenceEventId: string | null;
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    byteSize: number;
    sha256: string;
    redactionState: string;
  }): Promise<unknown>;
  createDeletionJob(input: {
    id: string;
    userId: string;
    kind: "evidence_file_object";
    targetId: string;
  }): Promise<unknown>;
  idFactory(): string;
  jobIdFactory(): string;
};

export type UploadEvidenceFileInput = {
  ownerUserId: string;
  vaultItemId: string;
  evidenceEventId?: string | null;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type EvidenceDownloadResult =
  | {
      kind: "bytes";
      bytes: Uint8Array;
      mimeType: string;
      filename: string;
    }
  | {
      kind: "redirect";
      url: string;
    };

export type EvidenceDownloadServiceDeps = {
  getEvidence(input: {
    ownerUserId: string;
    id: string;
  }): Promise<{
    storageKey: string;
    originalFilename: string;
    mimeType: string;
  } | null>;
  storage: EvidenceStorage;
};

export type GetEvidenceDownloadInput = {
  ownerUserId: string;
  evidenceFileId: string;
};

function normalizeValidationError(error: unknown): never {
  const message = error instanceof Error ? error.message : "invalid_request";
  if (message === "unsupported_file_type") {
    throw new EvidenceServiceError("unsupported_file_type");
  }
  if (message === "file_too_large") {
    throw new EvidenceServiceError("file_too_large");
  }
  throw new EvidenceServiceError("invalid_request");
}

export async function uploadEvidenceFile(
  input: UploadEvidenceFileInput,
  deps: EvidenceFileServiceDeps,
): Promise<EvidenceFileDto> {
  if (!(await deps.ownsVault(input.ownerUserId, input.vaultItemId))) {
    throw new EvidenceServiceError("not_found");
  }

  const evidenceEventId = input.evidenceEventId ?? null;
  if (
    evidenceEventId &&
    !(await deps.ownsEvent(input.ownerUserId, input.vaultItemId, evidenceEventId))
  ) {
    throw new EvidenceServiceError("not_found");
  }

  let validated: ReturnType<typeof validateEvidenceUpload>;
  try {
    validated = validateEvidenceUpload({
      filename: input.filename,
      mimeType: input.mimeType,
      bytes: input.bytes,
    });
  } catch (error) {
    normalizeValidationError(error);
  }

  const id = deps.idFactory();
  const storageKey = buildEvidenceStorageKey(input.ownerUserId, id);
  const sha256 = sha256Hex(input.bytes);

  try {
    await deps.storage.putObject({
      storageKey,
      bytes: input.bytes,
      mimeType: validated.mimeType,
    });
  } catch {
    throw new EvidenceServiceError("storage_unavailable");
  }

  const metadata = {
    id,
    userId: input.ownerUserId,
    vaultItemId: input.vaultItemId,
    evidenceEventId,
    storageKey,
    originalFilename: validated.filename,
    mimeType: validated.mimeType,
    byteSize: validated.byteSize,
    sha256,
    redactionState: "unreviewed",
  };

  try {
    await deps.createEvidence(metadata);
  } catch {
    try {
      await deps.storage.deleteObject(storageKey);
    } catch {
      await deps.createDeletionJob({
        id: deps.jobIdFactory(),
        userId: input.ownerUserId,
        kind: "evidence_file_object",
        targetId: id,
      });
      throw new EvidenceServiceError("storage_unavailable");
    }
    throw new EvidenceServiceError("metadata_persistence_failed");
  }

  return {
    id,
    vaultItemId: input.vaultItemId,
    evidenceEventId,
    originalFilename: validated.filename,
    mimeType: validated.mimeType,
    byteSize: validated.byteSize,
    sha256,
    redactionState: "unreviewed",
  };
}

export async function getEvidenceDownload(
  input: GetEvidenceDownloadInput,
  deps: EvidenceDownloadServiceDeps,
): Promise<EvidenceDownloadResult> {
  const evidence = await deps.getEvidence({
    ownerUserId: input.ownerUserId,
    id: input.evidenceFileId,
  });
  if (!evidence) throw new EvidenceServiceError("not_found");

  let target: Awaited<ReturnType<EvidenceStorage["getDownloadTarget"]>>;
  try {
    target = await deps.storage.getDownloadTarget({
      storageKey: evidence.storageKey,
      expiresInSeconds: 300,
    });
  } catch {
    throw new EvidenceServiceError("storage_unavailable");
  }

  if (target.kind === "redirect") {
    return { kind: "redirect", url: target.url };
  }

  return {
    kind: "bytes",
    bytes: target.bytes,
    mimeType: evidence.mimeType,
    filename: evidence.originalFilename,
  };
}

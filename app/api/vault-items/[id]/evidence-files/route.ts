import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { resolveProtectedUser } from "@/src/auth/protected-session";
import { getDb } from "@/src/db/client";
import { evidenceEvents } from "@/src/db/schema";
import { createDeletionJob } from "@/src/repositories/deletion-job-repository";
import { createEvidenceFile } from "@/src/repositories/evidence-repository";
import { getVaultItem } from "@/src/repositories/vault-repository";
import {
  EvidenceServiceError,
  uploadEvidenceFile,
  type EvidenceFileDto,
  type UploadEvidenceFileInput,
} from "@/src/services/evidence-file-service";
import { parseStorageConfig } from "@/src/storage/config";
import { createEvidenceStorage } from "@/src/storage/storage-factory";

const MAX_MULTIPART_REQUEST_BYTES = 21 * 1024 * 1024;

export type EvidenceUploadRouteDependencies = {
  resolveUser(rawToken: string | null): Promise<{ id: string; displayName: string } | null>;
  uploadEvidence(input: UploadEvidenceFileInput): Promise<EvidenceFileDto>;
};

type UploadFileLike = {
  name: string;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator < 0 || trimmed.slice(0, separator) !== name) continue;
    const value = trimmed.slice(separator + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

function jsonNoStore(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "no-store");
  return response;
}

function mapServiceError(error: unknown) {
  if (!(error instanceof EvidenceServiceError)) {
    return jsonNoStore({ error: "storage_unavailable" }, 503);
  }
  if (error.code === "not_found") return jsonNoStore({ error: "not_found" }, 404);
  if (
    error.code === "invalid_request" ||
    error.code === "unsupported_file_type" ||
    error.code === "file_too_large"
  ) {
    return jsonNoStore({ error: error.code }, 400);
  }
  return jsonNoStore({ error: "storage_unavailable" }, 503);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isUploadFile(value: unknown): value is UploadFileLike {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<UploadFileLike>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.arrayBuffer === "function"
  );
}

function declaredBodyTooLarge(request: Request) {
  const value = request.headers.get("content-length");
  if (!value || !/^\d+$/.test(value)) return false;
  return Number(value) > MAX_MULTIPART_REQUEST_BYTES;
}

export async function createEvidenceUploadResponse(
  request: Request,
  vaultItemId: string,
  dependencies: EvidenceUploadRouteDependencies,
) {
  const user = await dependencies.resolveUser(readCookie(request, "ev_session"));
  if (!user) return jsonNoStore({ error: "unauthorized" }, 401);

  if (declaredBodyTooLarge(request)) {
    return jsonNoStore({ error: "file_too_large" }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }

  const file = form.get("file");
  if (!isUploadFile(file)) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }

  const rawEventId = form.get("evidenceEventId");
  if (rawEventId !== null && typeof rawEventId !== "string") {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const evidenceEventId = rawEventId?.trim() || null;
  if (evidenceEventId && !isUuid(evidenceEventId)) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }

  try {
    const dto = await dependencies.uploadEvidence({
      ownerUserId: user.id,
      vaultItemId,
      evidenceEventId,
      filename: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return jsonNoStore(dto, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}

async function ownsEvent(ownerUserId: string, vaultItemId: string, evidenceEventId: string) {
  const [row] = await getDb()
    .select({ id: evidenceEvents.id })
    .from(evidenceEvents)
    .where(
      and(
        eq(evidenceEvents.id, evidenceEventId),
        eq(evidenceEvents.vaultItemId, vaultItemId),
        eq(evidenceEvents.createdByUserId, ownerUserId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function uploadEvidence(input: UploadEvidenceFileInput) {
  const storage = createEvidenceStorage(parseStorageConfig());
  return uploadEvidenceFile(input, {
    ownsVault: async (ownerUserId, vaultItemId) => Boolean(await getVaultItem({ ownerUserId, id: vaultItemId })),
    ownsEvent,
    storage,
    createEvidence: createEvidenceFile,
    createDeletionJob,
    idFactory: randomUUID,
    jobIdFactory: randomUUID,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return createEvidenceUploadResponse(request, id, {
    resolveUser: (rawToken) => resolveProtectedUser(rawToken),
    uploadEvidence,
  });
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveProtectedUser } from "@/src/auth/protected-session";
import {
  ensureDeletionJob,
  getDeletionJob,
  markDeletionJobBlocked,
  markDeletionJobCompleted,
  markDeletionJobQueued,
} from "@/src/repositories/deletion-job-repository";
import {
  getOwnedEvidenceFile,
  markEvidenceFileDeleted,
} from "@/src/repositories/evidence-repository";
import {
  DeletionServiceError,
  requestEvidenceDeletion,
  type DeletionReconciliationDeps,
} from "@/src/services/deletion-reconciliation";
import { parseStorageConfig } from "@/src/storage/config";
import { createEvidenceStorage } from "@/src/storage/storage-factory";

export type EvidenceDeleteRouteDependencies = {
  resolveUser(rawToken: string | null): Promise<{ id: string; displayName: string } | null>;
  requestDeletion(input: {
    ownerUserId: string;
    evidenceFileId: string;
  }): Promise<{ status: "accepted" }>;
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

export async function createEvidenceDeleteResponse(
  request: Request,
  evidenceFileId: string,
  dependencies: EvidenceDeleteRouteDependencies,
) {
  const user = await dependencies.resolveUser(readCookie(request, "ev_session"));
  if (!user) return jsonNoStore({ error: "unauthorized" }, 401);

  try {
    const result = await dependencies.requestDeletion({
      ownerUserId: user.id,
      evidenceFileId,
    });
    return jsonNoStore(result, 202);
  } catch (error) {
    if (error instanceof DeletionServiceError && error.code === "not_found") {
      return jsonNoStore({ error: "not_found" }, 404);
    }
    return jsonNoStore({ error: "storage_unavailable" }, 503);
  }
}

function createDeletionDeps(): DeletionReconciliationDeps {
  return {
    getEvidence: ({ ownerUserId, id }) => getOwnedEvidenceFile({ ownerUserId, id }),
    markDeleted: markEvidenceFileDeleted,
    ensureDeletionJob,
    getDeletionJob,
    markCompleted: markDeletionJobCompleted,
    markQueued: markDeletionJobQueued,
    markBlocked: markDeletionJobBlocked,
    storage: createEvidenceStorage(parseStorageConfig()),
    idFactory: randomUUID,
    now: () => new Date(),
  };
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return createEvidenceDeleteResponse(request, id, {
    resolveUser: (rawToken) => resolveProtectedUser(rawToken),
    requestDeletion: (input) => requestEvidenceDeletion(input, createDeletionDeps()),
  });
}

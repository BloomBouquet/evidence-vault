import { NextResponse } from "next/server";
import { resolveProtectedUser } from "@/src/auth/protected-session";
import { getEvidenceFile } from "@/src/repositories/evidence-repository";
import {
  EvidenceServiceError,
  getEvidenceDownload,
  type EvidenceDownloadResult,
} from "@/src/services/evidence-file-service";
import { parseStorageConfig } from "@/src/storage/config";
import { createEvidenceStorage } from "@/src/storage/storage-factory";

export type EvidenceDownloadRouteDependencies = {
  resolveUser(rawToken: string | null): Promise<{ id: string; displayName: string } | null>;
  getDownload(input: { ownerUserId: string; evidenceFileId: string }): Promise<EvidenceDownloadResult>;
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

function safeAttachmentFilename(filename: string) {
  const normalized = filename.replace(/[\\/\0\r\n"]/g, "_").trim();
  return normalized || "evidence";
}

function bytesResponse(download: Extract<EvidenceDownloadResult, { kind: "bytes" }>) {
  return new Response(download.bytes.slice(), {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": download.mimeType,
      "content-disposition": `attachment; filename="${safeAttachmentFilename(download.filename)}"`,
    },
  });
}

export async function createEvidenceDownloadResponse(
  request: Request,
  evidenceFileId: string,
  dependencies: EvidenceDownloadRouteDependencies,
) {
  const user = await dependencies.resolveUser(readCookie(request, "ev_session"));
  if (!user) return jsonNoStore({ error: "unauthorized" }, 401);

  try {
    const download = await dependencies.getDownload({
      ownerUserId: user.id,
      evidenceFileId,
    });
    if (download.kind === "bytes") return bytesResponse(download);

    return new Response(null, {
      status: 307,
      headers: {
        "cache-control": "no-store",
        location: download.url,
      },
    });
  } catch (error) {
    if (error instanceof EvidenceServiceError && error.code === "not_found") {
      return jsonNoStore({ error: "not_found" }, 404);
    }
    return jsonNoStore({ error: "storage_unavailable" }, 503);
  }
}

async function getDownload(input: { ownerUserId: string; evidenceFileId: string }) {
  const storage = createEvidenceStorage(parseStorageConfig());
  return getEvidenceDownload(input, {
    getEvidence: ({ ownerUserId, id }) => getEvidenceFile({ ownerUserId, id }),
    storage,
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return createEvidenceDownloadResponse(request, id, {
    resolveUser: (rawToken) => resolveProtectedUser(rawToken),
    getDownload,
  });
}

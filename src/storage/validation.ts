import { createHash } from "node:crypto";

export const MAX_EVIDENCE_FILE_BYTES = 20 * 1024 * 1024;

const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type EvidenceUploadValidationInput = {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type ValidatedEvidenceUpload = {
  filename: string;
  mimeType: string;
  byteSize: number;
};

function normalizeFilename(filename: string): string {
  const normalized = filename
    .replace(/[\\/\0\r\n]/g, "_")
    .trim()
    .slice(0, 255);

  return normalized || "evidence";
}

export function validateEvidenceUpload(
  input: EvidenceUploadValidationInput,
): ValidatedEvidenceUpload {
  if (input.bytes.byteLength === 0) throw new Error("empty_file");
  if (input.bytes.byteLength > MAX_EVIDENCE_FILE_BYTES) {
    throw new Error("file_too_large");
  }
  if (!ALLOWED_EVIDENCE_MIME_TYPES.has(input.mimeType)) {
    throw new Error("unsupported_file_type");
  }

  return {
    filename: normalizeFilename(input.filename),
    mimeType: input.mimeType,
    byteSize: input.bytes.byteLength,
  };
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

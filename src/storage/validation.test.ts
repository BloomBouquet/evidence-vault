import { describe, expect, it } from "vitest";
import {
  MAX_EVIDENCE_FILE_BYTES,
  sha256Hex,
  validateEvidenceUpload,
} from "./validation";
import { buildEvidenceStorageKey } from "./key";

const makeBytes = (size: number) => new Uint8Array(size);

describe("evidence upload validation", () => {
  it.each([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ])("accepts supported MIME type %s", (mimeType) => {
    expect(
      validateEvidenceUpload({
        filename: "receipt.pdf",
        mimeType,
        bytes: new Uint8Array([1]),
      }),
    ).toEqual({
      filename: "receipt.pdf",
      mimeType,
      byteSize: 1,
    });
  });

  it("rejects empty files", () => {
    expect(() =>
      validateEvidenceUpload({
        filename: "empty.pdf",
        mimeType: "application/pdf",
        bytes: new Uint8Array(),
      }),
    ).toThrow("empty_file");
  });

  it("accepts exactly 20 MiB and rejects one byte above", () => {
    expect(
      validateEvidenceUpload({
        filename: "limit.pdf",
        mimeType: "application/pdf",
        bytes: makeBytes(MAX_EVIDENCE_FILE_BYTES),
      }).byteSize,
    ).toBe(MAX_EVIDENCE_FILE_BYTES);

    expect(() =>
      validateEvidenceUpload({
        filename: "too-large.pdf",
        mimeType: "application/pdf",
        bytes: makeBytes(MAX_EVIDENCE_FILE_BYTES + 1),
      }),
    ).toThrow("file_too_large");
  });

  it("rejects unsupported MIME types", () => {
    expect(() =>
      validateEvidenceUpload({
        filename: "script.svg",
        mimeType: "image/svg+xml",
        bytes: new Uint8Array([1]),
      }),
    ).toThrow("unsupported_file_type");
  });

  it("hashes the exact uploaded bytes with SHA-256", () => {
    expect(sha256Hex(new TextEncoder().encode("evidence"))).toBe(
      "ee8250fb76e094b34b471f13a73dbbe51d1ae142e9df59d7c0d31ec20f0a0a8e",
    );
  });

  it("builds a deterministic key without user filenames", () => {
    expect(
      buildEvidenceStorageKey(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ),
    ).toBe(
      "users/11111111-1111-4111-8111-111111111111/evidence/22222222-2222-4222-8222-222222222222",
    );
  });
});

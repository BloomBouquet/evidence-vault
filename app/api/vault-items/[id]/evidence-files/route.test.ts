import { describe, expect, it, vi } from "vitest";
import { EvidenceServiceError, type EvidenceFileDto } from "@/src/services/evidence-file-service";
import {
  createEvidenceUploadResponse,
  type EvidenceUploadRouteDependencies,
} from "./route";

const user = { id: "11111111-1111-4111-8111-111111111111", displayName: "Sun" };
const vaultItemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const dto: EvidenceFileDto = {
  id: "22222222-2222-4222-8222-222222222222",
  vaultItemId,
  evidenceEventId: eventId,
  originalFilename: "receipt.pdf",
  mimeType: "application/pdf",
  byteSize: 8,
  sha256: "ee8250fb76e094b34b471f13a73dbbe51d1ae142e9df59d7c0d31ec20f0a0a8e",
  redactionState: "unreviewed",
};

function deps(overrides: Partial<EvidenceUploadRouteDependencies> = {}): EvidenceUploadRouteDependencies {
  return {
    resolveUser: vi.fn(async () => user),
    uploadEvidence: vi.fn(async () => dto),
    ...overrides,
  };
}

function multipartRequest(includeFile = true) {
  const request = new Request("http://localhost/api/vault-items/" + vaultItemId + "/evidence-files", {
    method: "POST",
    headers: { cookie: "ev_session=session-token" },
  });
  const bytes = new TextEncoder().encode("evidence");
  const file = {
    name: "receipt.pdf",
    type: "application/pdf",
    arrayBuffer: vi.fn(async () => bytes.slice().buffer),
  };
  const form = {
    get(name: string) {
      if (name === "file") return includeFile ? file : null;
      if (name === "evidenceEventId") return eventId;
      return null;
    },
  } as unknown as FormData;

  Object.defineProperty(request, "formData", {
    configurable: true,
    value: vi.fn(async () => form),
  });
  return request;
}

describe("evidence upload route", () => {
  it("returns 401 with no-store for anonymous requests", async () => {
    const fake = deps({ resolveUser: vi.fn(async () => null) });
    const response = await createEvidenceUploadResponse(multipartRequest(), vaultItemId, fake);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(fake.uploadEvidence).not.toHaveBeenCalled();
  });

  it("rejects an oversized multipart body before parsing it", async () => {
    const request = multipartRequest();
    request.headers.set("content-length", String(21 * 1024 * 1024 + 1));
    const formDataSpy = request.formData as unknown as ReturnType<typeof vi.fn>;
    const fake = deps();

    const response = await createEvidenceUploadResponse(request, vaultItemId, fake);

    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "file_too_large" });
    expect(formDataSpy).not.toHaveBeenCalled();
    expect(fake.uploadEvidence).not.toHaveBeenCalled();
  });

  it("rejects multipart requests without a file", async () => {
    const fake = deps();
    const response = await createEvidenceUploadResponse(multipartRequest(false), vaultItemId, fake);

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "invalid_request" });
    expect(fake.uploadEvidence).not.toHaveBeenCalled();
  });

  it("passes authenticated multipart bytes to the upload service and returns only the public DTO", async () => {
    const fake = deps();
    const response = await createEvidenceUploadResponse(multipartRequest(), vaultItemId, fake);

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fake.uploadEvidence).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: user.id,
      vaultItemId,
      evidenceEventId: eventId,
      filename: "receipt.pdf",
      mimeType: "application/pdf",
      bytes: expect.any(Uint8Array),
    }));
    const body = await response.json();
    expect(body).toEqual(dto);
    expect(body).not.toHaveProperty("storageKey");
    expect(body).not.toHaveProperty("bucket");
    expect(body).not.toHaveProperty("url");
  });

  it("uses the same 404 body for missing or foreign resources", async () => {
    const fake = deps({ uploadEvidence: vi.fn(async () => { throw new EvidenceServiceError("not_found"); }) });
    const response = await createEvidenceUploadResponse(multipartRequest(), vaultItemId, fake);

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it.each([
    ["unsupported_file_type", "unsupported_file_type"],
    ["file_too_large", "file_too_large"],
    ["invalid_request", "invalid_request"],
  ] as const)("maps %s to a normalized 400", async (serviceCode, publicCode) => {
    const fake = deps({ uploadEvidence: vi.fn(async () => { throw new EvidenceServiceError(serviceCode); }) });
    const response = await createEvidenceUploadResponse(multipartRequest(), vaultItemId, fake);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: publicCode });
  });
});

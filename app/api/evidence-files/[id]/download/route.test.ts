import { describe, expect, it, vi } from "vitest";
import { EvidenceServiceError } from "@/src/services/evidence-file-service";
import {
  createEvidenceDownloadResponse,
  type EvidenceDownloadRouteDependencies,
} from "./route";

const user = { id: "11111111-1111-4111-8111-111111111111", displayName: "Sun" };
const evidenceFileId = "22222222-2222-4222-8222-222222222222";

function request() {
  return new Request("http://localhost/api/evidence-files/" + evidenceFileId + "/download", {
    method: "GET",
    headers: { cookie: "ev_session=session-token" },
  });
}

function deps(overrides: Partial<EvidenceDownloadRouteDependencies> = {}): EvidenceDownloadRouteDependencies {
  return {
    resolveUser: vi.fn(async () => user),
    getDownload: vi.fn(async () => ({
      kind: "bytes" as const,
      bytes: new TextEncoder().encode("evidence"),
      mimeType: "application/pdf",
      filename: "receipt.pdf",
    })),
    ...overrides,
  };
}

describe("evidence download route", () => {
  it("returns 401 with no-store for anonymous requests", async () => {
    const fake = deps({ resolveUser: vi.fn(async () => null) });
    const response = await createEvidenceDownloadResponse(request(), evidenceFileId, fake);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(fake.getDownload).not.toHaveBeenCalled();
  });

  it("uses the same not-found response for missing, deleted, or foreign files", async () => {
    const fake = deps({ getDownload: vi.fn(async () => { throw new EvidenceServiceError("not_found"); }) });
    const response = await createEvidenceDownloadResponse(request(), evidenceFileId, fake);

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("streams local bytes with stored MIME type and attachment filename", async () => {
    const fake = deps();
    const response = await createEvidenceDownloadResponse(request(), evidenceFileId, fake);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="receipt.pdf"');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new TextEncoder().encode("evidence"));
    expect(fake.getDownload).toHaveBeenCalledWith({ ownerUserId: user.id, evidenceFileId });
  });

  it("returns a temporary redirect only after authenticated owner-scoped authorization", async () => {
    const fake = deps({
      getDownload: vi.fn(async () => ({
        kind: "redirect" as const,
        url: "https://signed.example/private-object?sig=secret",
      })),
    });
    const response = await createEvidenceDownloadResponse(request(), evidenceFileId, fake);

    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("location")).toBe("https://signed.example/private-object?sig=secret");
    expect(fake.getDownload).toHaveBeenCalledWith({ ownerUserId: user.id, evidenceFileId });
  });

  it("normalizes provider failures without exposing storage details", async () => {
    const fake = deps({ getDownload: vi.fn(async () => { throw new EvidenceServiceError("storage_unavailable"); }) });
    const response = await createEvidenceDownloadResponse(request(), evidenceFileId, fake);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual({ error: "storage_unavailable" });
    expect(JSON.stringify(body)).not.toContain("bucket");
    expect(JSON.stringify(body)).not.toContain("storageKey");
  });
});

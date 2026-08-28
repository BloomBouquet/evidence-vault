import { describe, expect, it, vi } from "vitest";
import { DeletionServiceError } from "@/src/services/deletion-reconciliation";
import {
  createEvidenceDeleteResponse,
  type EvidenceDeleteRouteDependencies,
} from "./route";

const user = { id: "11111111-1111-4111-8111-111111111111", displayName: "Sun" };
const evidenceFileId = "22222222-2222-4222-8222-222222222222";

function request(cookie = "ev_session=session-token") {
  return new Request("http://localhost/api/evidence-files/" + evidenceFileId, {
    method: "DELETE",
    headers: cookie ? { cookie } : undefined,
  });
}

function deps(overrides: Partial<EvidenceDeleteRouteDependencies> = {}): EvidenceDeleteRouteDependencies {
  return {
    resolveUser: vi.fn(async () => user),
    requestDeletion: vi.fn(async () => ({ status: "accepted" as const })),
    ...overrides,
  };
}

describe("evidence delete route", () => {
  it("returns 401 with no-store for anonymous requests", async () => {
    const fake = deps({ resolveUser: vi.fn(async () => null) });
    const response = await createEvidenceDeleteResponse(request(""), evidenceFileId, fake);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(fake.requestDeletion).not.toHaveBeenCalled();
  });

  it("returns the same 404 body for missing or foreign files", async () => {
    const fake = deps({
      requestDeletion: vi.fn(async () => { throw new DeletionServiceError("not_found"); }),
    });
    const response = await createEvidenceDeleteResponse(request(), evidenceFileId, fake);

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("returns 202 accepted after application access is revoked without claiming physical deletion completed", async () => {
    const fake = deps();
    const response = await createEvidenceDeleteResponse(request(), evidenceFileId, fake);

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "accepted" });
    expect(fake.requestDeletion).toHaveBeenCalledWith({ ownerUserId: user.id, evidenceFileId });
  });
});

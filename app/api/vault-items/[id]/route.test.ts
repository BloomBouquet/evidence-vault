import { describe, expect, it, vi } from "vitest";
import { createVaultDetailResponse, type VaultDetailDependencies } from "./route";

const row = {
  id: "vault-1",
  userId: "user-a",
  title: "노트북 구매",
  category: "online_purchase",
  merchantName: null,
  purchaseOrStartDate: "2026-08-28",
  amount: null,
  currency: "KRW",
  description: null,
  status: "active",
  createdAt: new Date("2026-08-28T00:00:00Z"),
  updatedAt: new Date("2026-08-28T00:00:00Z"),
};

function deps(overrides: Partial<VaultDetailDependencies> = {}): VaultDetailDependencies {
  return {
    resolveUser: vi.fn(async () => ({ id: "user-a", displayName: "순우" })),
    get: vi.fn(async () => row),
    update: vi.fn(async () => row),
    ...overrides,
  };
}

describe("vault detail API", () => {
  it("maps missing and unowned resources to the same 404", async () => {
    const response = await createVaultDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-b"),
      { params: Promise.resolve({ id: "vault-b" }) },
      deps({ get: vi.fn(async () => null) }),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("returns a safe owned detail without userId", async () => {
    const response = await createVaultDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1"),
      { params: Promise.resolve({ id: "vault-1" }) },
      deps(),
    );
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).not.toContain("user-a");
    expect(JSON.parse(text).item.id).toBe("vault-1");
  });

  it("returns 400/422 for malformed or invalid patches", async () => {
    const malformed = await createVaultDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1", { method: "PATCH", body: "{" }),
      { params: Promise.resolve({ id: "vault-1" }) },
      deps(),
    );
    expect(malformed.status).toBe(400);

    const invalid = await createVaultDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "vault-1" }) },
      deps(),
    );
    expect(invalid.status).toBe(422);
  });

  it("updates with the server owner and maps repository null to 404", async () => {
    const update = vi.fn(async () => null);
    const response = await createVaultDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "수정됨", ownerUserId: "user-b" }),
      }),
      { params: Promise.resolve({ id: "vault-1" }) },
      deps({ update }),
    );
    expect(update).toHaveBeenCalledWith({ ownerUserId: "user-a", id: "vault-1", input: { title: "수정됨" } });
    expect(response.status).toBe(404);
  });
});

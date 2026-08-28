import { describe, expect, it, vi } from "vitest";
import { createVaultArchiveResponse, type VaultArchiveDependencies } from "./route";

const archived = {
  id: "vault-1",
  userId: "user-a",
  title: "노트북 구매",
  category: "online_purchase",
  merchantName: null,
  purchaseOrStartDate: "2026-08-28",
  amount: null,
  currency: "KRW",
  description: null,
  status: "archived",
  createdAt: new Date("2026-08-28T00:00:00Z"),
  updatedAt: new Date("2026-08-28T01:00:00Z"),
};

function deps(overrides: Partial<VaultArchiveDependencies> = {}): VaultArchiveDependencies {
  return {
    resolveUser: vi.fn(async () => ({ id: "user-a", displayName: "순우" })),
    archive: vi.fn(async () => archived),
    ...overrides,
  };
}

describe("vault archive API", () => {
  it("requires authentication", async () => {
    const response = await createVaultArchiveResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/archive", { method: "POST" }),
      { params: Promise.resolve({ id: "vault-1" }) },
      deps({ resolveUser: vi.fn(async () => null) }),
    );
    expect(response.status).toBe(401);
  });

  it("maps missing or unowned items to 404", async () => {
    const response = await createVaultArchiveResponse(
      new Request("https://vault.example.com/api/vault-items/vault-b/archive", { method: "POST" }),
      { params: Promise.resolve({ id: "vault-b" }) },
      deps({ archive: vi.fn(async () => null) }),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("archives with the server-derived owner and returns a safe DTO", async () => {
    const dependencies = deps();
    const response = await createVaultArchiveResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/archive", { method: "POST" }),
      { params: Promise.resolve({ id: "vault-1" }) },
      dependencies,
    );
    expect(dependencies.archive).toHaveBeenCalledWith({ ownerUserId: "user-a", id: "vault-1" });
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).not.toContain("user-a");
    expect(JSON.parse(text).item.status).toBe("archived");
  });
});

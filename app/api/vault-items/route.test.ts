import { describe, expect, it, vi } from "vitest";
import { createVaultCollectionResponse, type VaultCollectionDependencies } from "./route";

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

function deps(overrides: Partial<VaultCollectionDependencies> = {}): VaultCollectionDependencies {
  return {
    resolveUser: vi.fn(async () => ({ id: "user-a", displayName: "순우" })),
    list: vi.fn(async () => [row]),
    create: vi.fn(async () => row),
    ...overrides,
  };
}

describe("vault collection API", () => {
  it("returns 401 without an active project session", async () => {
    const response = await createVaultCollectionResponse(
      new Request("https://vault.example.com/api/vault-items"),
      deps({ resolveUser: vi.fn(async () => null) }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ error: "authentication_required" });
  });

  it("lists only safe vault DTO fields", async () => {
    const dependencies = deps();
    const response = await createVaultCollectionResponse(
      new Request("https://vault.example.com/api/vault-items"),
      dependencies,
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("user-a");
    expect(JSON.parse(text)).toEqual({ items: [expect.objectContaining({ id: "vault-1", title: "노트북 구매" })] });
    expect(dependencies.list).toHaveBeenCalledWith({ ownerUserId: "user-a" });
  });

  it("normalizes malformed and invalid create bodies", async () => {
    const malformed = await createVaultCollectionResponse(
      new Request("https://vault.example.com/api/vault-items", { method: "POST", body: "{" }),
      deps(),
    );
    expect(malformed.status).toBe(400);

    const invalid = await createVaultCollectionResponse(
      new Request("https://vault.example.com/api/vault-items", {
        method: "POST",
        body: JSON.stringify({ title: "" }),
      }),
      deps(),
    );
    expect(invalid.status).toBe(422);
  });

  it("creates with the server-derived owner and never client ownership", async () => {
    const dependencies = deps();
    const response = await createVaultCollectionResponse(
      new Request("https://vault.example.com/api/vault-items", {
        method: "POST",
        headers: { cookie: "ev_session=raw-project-session", "content-type": "application/json" },
        body: JSON.stringify({
          title: "노트북 구매",
          category: "online_purchase",
          purchaseOrStartDate: "2026-08-28",
          ownerUserId: "user-b",
          userId: "user-b",
        }),
      }),
      dependencies,
    );
    expect(response.status).toBe(201);
    expect(dependencies.create).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      input: expect.objectContaining({ title: "노트북 구매", category: "online_purchase" }),
    });
    const text = await response.text();
    expect(text).not.toContain("user-a");
    expect(text).not.toContain("user-b");
    expect(text).not.toContain("raw-project-session");
  });
});

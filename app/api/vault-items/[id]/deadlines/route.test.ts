import { describe, expect, it, vi } from "vitest";
import { createDeadlineCollectionResponse, type DeadlineCollectionDependencies } from "./route";

const deadline = {
  id: "deadline-1",
  vaultItemId: "vault-1",
  type: "custom",
  dueDate: "2026-09-01",
  sourceType: "user_entered",
  sourceNote: null,
  reminderState: "active",
  createdAt: new Date("2026-08-28T00:00:00Z"),
  updatedAt: new Date("2026-08-28T00:00:00Z"),
};

function deps(overrides: Partial<DeadlineCollectionDependencies> = {}): DeadlineCollectionDependencies {
  return {
    resolveUser: vi.fn(async () => ({ id: "user-a", displayName: "순우" })),
    list: vi.fn(async () => [deadline]),
    create: vi.fn(async () => deadline),
    ...overrides,
  };
}

const context = { params: Promise.resolve({ id: "vault-1" }) };

describe("deadline collection API", () => {
  it("requires authentication", async () => {
    const response = await createDeadlineCollectionResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/deadlines"),
      context,
      deps({ resolveUser: vi.fn(async () => null) }),
    );
    expect(response.status).toBe(401);
  });

  it("maps an unowned parent to 404", async () => {
    const response = await createDeadlineCollectionResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/deadlines"),
      context,
      deps({ list: vi.fn(async () => null) }),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("lists owned deadlines with no-store", async () => {
    const dependencies = deps();
    const response = await createDeadlineCollectionResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/deadlines"),
      context,
      dependencies,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(dependencies.list).toHaveBeenCalledWith({ ownerUserId: "user-a", vaultItemId: "vault-1" });
  });

  it("validates create input and uses only the server owner", async () => {
    const invalid = await createDeadlineCollectionResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/deadlines", {
        method: "POST",
        body: JSON.stringify({ dueDate: "bad" }),
      }),
      context,
      deps(),
    );
    expect(invalid.status).toBe(422);

    const dependencies = deps();
    const response = await createDeadlineCollectionResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/deadlines", {
        method: "POST",
        body: JSON.stringify({
          type: "custom",
          dueDate: "2026-09-01",
          sourceType: "user_entered",
          ownerUserId: "user-b",
        }),
      }),
      context,
      dependencies,
    );
    expect(response.status).toBe(201);
    expect(dependencies.create).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      vaultItemId: "vault-1",
      input: { type: "custom", dueDate: "2026-09-01", sourceType: "user_entered" },
    });
  });
});

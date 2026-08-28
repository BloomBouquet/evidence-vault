import { describe, expect, it, vi } from "vitest";
import { createDeadlineDetailResponse, type DeadlineDetailDependencies } from "./route";

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

function deps(overrides: Partial<DeadlineDetailDependencies> = {}): DeadlineDetailDependencies {
  return {
    resolveUser: vi.fn(async () => ({ id: "user-a", displayName: "순우" })),
    update: vi.fn(async () => deadline),
    delete: vi.fn(async () => true),
    ...overrides,
  };
}

const context = { params: Promise.resolve({ id: "vault-1", deadlineId: "deadline-1" }) };

describe("deadline detail API", () => {
  it("maps missing or unowned updates to 404", async () => {
    const response = await createDeadlineDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/deadlines/deadline-1", {
        method: "PATCH",
        body: JSON.stringify({ sourceNote: null }),
      }),
      context,
      deps({ update: vi.fn(async () => null) }),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("validates update and uses owner + parent + nested id", async () => {
    const invalid = await createDeadlineDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/deadlines/deadline-1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      context,
      deps(),
    );
    expect(invalid.status).toBe(422);

    const dependencies = deps();
    const response = await createDeadlineDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/deadlines/deadline-1", {
        method: "PATCH",
        body: JSON.stringify({ dueDate: "2026-09-02", ownerUserId: "user-b" }),
      }),
      context,
      dependencies,
    );
    expect(response.status).toBe(200);
    expect(dependencies.update).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      vaultItemId: "vault-1",
      deadlineId: "deadline-1",
      input: { dueDate: "2026-09-02" },
    });
  });

  it("deletes owned deadlines with 204 and no-store", async () => {
    const dependencies = deps();
    const response = await createDeadlineDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/deadlines/deadline-1", { method: "DELETE" }),
      context,
      dependencies,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(dependencies.delete).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      vaultItemId: "vault-1",
      deadlineId: "deadline-1",
    });
  });

  it("maps missing or unowned deletes to 404", async () => {
    const response = await createDeadlineDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/deadlines/deadline-1", { method: "DELETE" }),
      context,
      deps({ delete: vi.fn(async () => null) }),
    );
    expect(response.status).toBe(404);
  });
});

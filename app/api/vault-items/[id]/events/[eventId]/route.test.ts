import { describe, expect, it, vi } from "vitest";
import { createEventDetailResponse, type EventDetailDependencies } from "./route";

const event = {
  id: "event-1",
  vaultItemId: "vault-1",
  createdByUserId: "user-a",
  occurredOn: "2026-08-28",
  eventType: "custom",
  title: "문의함",
  note: null,
  createdAt: new Date("2026-08-28T00:00:00Z"),
  updatedAt: new Date("2026-08-28T00:00:00Z"),
};

function deps(overrides: Partial<EventDetailDependencies> = {}): EventDetailDependencies {
  return {
    resolveUser: vi.fn(async () => ({ id: "user-a", displayName: "순우" })),
    update: vi.fn(async () => event),
    delete: vi.fn(async () => true),
    ...overrides,
  };
}

const context = { params: Promise.resolve({ id: "vault-1", eventId: "event-1" }) };

describe("evidence event detail API", () => {
  it("maps missing or unowned updates to 404", async () => {
    const response = await createEventDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/events/event-1", {
        method: "PATCH",
        body: JSON.stringify({ note: null }),
      }),
      context,
      deps({ update: vi.fn(async () => null) }),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("validates patch and strips client ownership fields", async () => {
    const invalid = await createEventDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/events/event-1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      context,
      deps(),
    );
    expect(invalid.status).toBe(422);

    const dependencies = deps();
    const response = await createEventDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/events/event-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "답변 받음", createdByUserId: "user-b", ownerUserId: "user-b" }),
      }),
      context,
      dependencies,
    );
    expect(response.status).toBe(200);
    expect(dependencies.update).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      vaultItemId: "vault-1",
      eventId: "event-1",
      input: { title: "답변 받음" },
    });
    expect(await response.text()).not.toContain("user-a");
  });

  it("deletes owned events with 204 and maps unowned deletes to 404", async () => {
    const success = await createEventDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/events/event-1", { method: "DELETE" }),
      context,
      deps(),
    );
    expect(success.status).toBe(204);
    expect(success.headers.get("cache-control")).toContain("no-store");

    const missing = await createEventDetailResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/events/event-1", { method: "DELETE" }),
      context,
      deps({ delete: vi.fn(async () => null) }),
    );
    expect(missing.status).toBe(404);
  });
});

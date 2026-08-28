import { describe, expect, it, vi } from "vitest";
import { createEventCollectionResponse, type EventCollectionDependencies } from "./route";

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

function deps(overrides: Partial<EventCollectionDependencies> = {}): EventCollectionDependencies {
  return {
    resolveUser: vi.fn(async () => ({ id: "user-a", displayName: "순우" })),
    list: vi.fn(async () => [event]),
    create: vi.fn(async () => event),
    ...overrides,
  };
}

const context = { params: Promise.resolve({ id: "vault-1" }) };

describe("evidence event collection API", () => {
  it("requires authentication and maps an unowned parent to 404", async () => {
    const anonymous = await createEventCollectionResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/events"),
      context,
      deps({ resolveUser: vi.fn(async () => null) }),
    );
    expect(anonymous.status).toBe(401);

    const unowned = await createEventCollectionResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/events"),
      context,
      deps({ list: vi.fn(async () => null) }),
    );
    expect(unowned.status).toBe(404);
  });

  it("lists safe event DTOs without createdByUserId", async () => {
    const response = await createEventCollectionResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/events"),
      context,
      deps(),
    );
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(text).not.toContain("user-a");
    expect(JSON.parse(text).events[0].id).toBe("event-1");
  });

  it("validates create and ignores client creator/owner fields", async () => {
    const invalid = await createEventCollectionResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/events", {
        method: "POST",
        body: JSON.stringify({ title: "" }),
      }),
      context,
      deps(),
    );
    expect(invalid.status).toBe(422);

    const dependencies = deps();
    const response = await createEventCollectionResponse(
      new Request("https://vault.example.com/api/vault-items/vault-1/events", {
        method: "POST",
        body: JSON.stringify({
          occurredOn: "2026-08-28",
          eventType: "custom",
          title: "문의함",
          createdByUserId: "user-b",
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
      input: { occurredOn: "2026-08-28", eventType: "custom", title: "문의함" },
    });
    expect(await response.text()).not.toContain("user-a");
  });
});

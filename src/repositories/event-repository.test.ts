import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  createEvidenceEvent,
  createEvidenceEventWithStore,
  deleteEvidenceEvent,
  deleteEvidenceEventWithStore,
  listEvidenceEventsWithStore,
  updateEvidenceEvent,
  updateEvidenceEventWithStore,
  type EventStore,
} from "./event-repository";

function store(owns = true): EventStore {
  return {
    ownsVault: vi.fn(async () => owns),
    list: vi.fn(async () => []),
    create: vi.fn(async () => null),
    update: vi.fn(async () => null),
    delete: vi.fn(async () => false),
  };
}

describe("event repository ownership", () => {
  it("requires owner, parent id, and nested id for mutations", () => {
    expectTypeOf(updateEvidenceEvent).parameter(0).toMatchTypeOf<{
      ownerUserId: string;
      vaultItemId: string;
      eventId: string;
    }>();
    expectTypeOf(deleteEvidenceEvent).parameter(0).toMatchTypeOf<{
      ownerUserId: string;
      vaultItemId: string;
      eventId: string;
    }>();
    expectTypeOf(createEvidenceEvent).parameter(0).toMatchTypeOf<{
      ownerUserId: string;
      vaultItemId: string;
    }>();
  });

  it("refuses nested operations when the parent is not owned", async () => {
    const fake = store(false);
    await expect(listEvidenceEventsWithStore(fake, { ownerUserId: "user-a", vaultItemId: "vault-b" })).resolves.toBeNull();
    await expect(createEvidenceEventWithStore(fake, {
      ownerUserId: "user-a",
      vaultItemId: "vault-b",
      input: { occurredOn: "2026-08-28", eventType: "custom", title: "문의함" },
    })).resolves.toBeNull();
    await expect(updateEvidenceEventWithStore(fake, {
      ownerUserId: "user-a",
      vaultItemId: "vault-b",
      eventId: "event-b",
      input: { note: null },
    })).resolves.toBeNull();
    await expect(deleteEvidenceEventWithStore(fake, {
      ownerUserId: "user-a",
      vaultItemId: "vault-b",
      eventId: "event-b",
    })).resolves.toBeNull();

    expect(fake.list).not.toHaveBeenCalled();
    expect(fake.create).not.toHaveBeenCalled();
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.delete).not.toHaveBeenCalled();
  });

  it("injects the authenticated owner as createdByUserId", async () => {
    const fake = store(true);
    const input = { occurredOn: "2026-08-28", eventType: "custom" as const, title: "문의함" };
    await createEvidenceEventWithStore(fake, { ownerUserId: "user-a", vaultItemId: "vault-1", input });
    expect(fake.create).toHaveBeenCalledWith("vault-1", "user-a", input);
  });
});

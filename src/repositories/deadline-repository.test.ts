import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  createDeadline,
  createDeadlineWithStore,
  deleteDeadline,
  deleteDeadlineWithStore,
  listDeadlinesWithStore,
  updateDeadline,
  updateDeadlineWithStore,
  type DeadlineStore,
} from "./deadline-repository";

function store(owns = true): DeadlineStore {
  return {
    ownsVault: vi.fn(async () => owns),
    list: vi.fn(async () => []),
    create: vi.fn(async () => null),
    update: vi.fn(async () => null),
    delete: vi.fn(async () => false),
  };
}

describe("deadline repository ownership", () => {
  it("requires owner, parent id, and nested id for mutations", () => {
    expectTypeOf(updateDeadline).parameter(0).toMatchTypeOf<{
      ownerUserId: string;
      vaultItemId: string;
      deadlineId: string;
    }>();
    expectTypeOf(deleteDeadline).parameter(0).toMatchTypeOf<{
      ownerUserId: string;
      vaultItemId: string;
      deadlineId: string;
    }>();
    expectTypeOf(createDeadline).parameter(0).toMatchTypeOf<{
      ownerUserId: string;
      vaultItemId: string;
    }>();
  });

  it("refuses nested operations when the parent is not owned", async () => {
    const fake = store(false);
    await expect(listDeadlinesWithStore(fake, { ownerUserId: "user-a", vaultItemId: "vault-b" })).resolves.toBeNull();
    await expect(createDeadlineWithStore(fake, {
      ownerUserId: "user-a",
      vaultItemId: "vault-b",
      input: { type: "custom", dueDate: "2026-09-01", sourceType: "user_entered" },
    })).resolves.toBeNull();
    await expect(updateDeadlineWithStore(fake, {
      ownerUserId: "user-a",
      vaultItemId: "vault-b",
      deadlineId: "deadline-b",
      input: { dueDate: "2026-09-02" },
    })).resolves.toBeNull();
    await expect(deleteDeadlineWithStore(fake, {
      ownerUserId: "user-a",
      vaultItemId: "vault-b",
      deadlineId: "deadline-b",
    })).resolves.toBeNull();

    expect(fake.list).not.toHaveBeenCalled();
    expect(fake.create).not.toHaveBeenCalled();
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.delete).not.toHaveBeenCalled();
  });

  it("passes the parent id into nested mutations after ownership proof", async () => {
    const fake = store(true);
    await updateDeadlineWithStore(fake, {
      ownerUserId: "user-a",
      vaultItemId: "vault-1",
      deadlineId: "deadline-1",
      input: { sourceNote: null },
    });
    await deleteDeadlineWithStore(fake, {
      ownerUserId: "user-a",
      vaultItemId: "vault-1",
      deadlineId: "deadline-1",
    });

    expect(fake.ownsVault).toHaveBeenCalledWith("user-a", "vault-1");
    expect(fake.update).toHaveBeenCalledWith("vault-1", "deadline-1", { sourceNote: null });
    expect(fake.delete).toHaveBeenCalledWith("vault-1", "deadline-1");
  });
});

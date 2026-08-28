import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { CreateVaultItemInput, UpdateVaultItemInput } from "@/src/domain/vault-item";
import {
  archiveVaultItem,
  archiveVaultItemWithStore,
  createVaultItemWithStore,
  getVaultItem,
  getVaultItemWithStore,
  listVaultItemsWithStore,
  updateVaultItem,
  updateVaultItemWithStore,
  type VaultStore,
} from "./vault-repository";

const createInput: CreateVaultItemInput = {
  title: "노트북 구매",
  category: "online_purchase",
  purchaseOrStartDate: "2026-08-28",
  currency: "KRW",
};

function store(): VaultStore {
  return {
    list: vi.fn(async () => []),
    create: vi.fn(async (_ownerUserId, input) => ({ id: "vault-1", ...input })),
    get: vi.fn(async () => null),
    update: vi.fn(async () => null),
    archive: vi.fn(async () => null),
  };
}

describe("vault repository ownership contract", () => {
  it("requires ownerUserId for owned reads and mutations", () => {
    expectTypeOf(getVaultItem).parameter(0).toMatchTypeOf<{ ownerUserId: string; id: string }>();
    expectTypeOf(updateVaultItem).parameter(0).toMatchTypeOf<{ ownerUserId: string; id: string }>();
    expectTypeOf(archiveVaultItem).parameter(0).toMatchTypeOf<{ ownerUserId: string; id: string }>();
  });

  it("passes the server owner through every store operation", async () => {
    const fake = store();
    const patch: UpdateVaultItemInput = { title: "수정된 기록" };

    await listVaultItemsWithStore(fake, { ownerUserId: "user-a" });
    await createVaultItemWithStore(fake, { ownerUserId: "user-a", input: createInput });
    await getVaultItemWithStore(fake, { ownerUserId: "user-a", id: "vault-1" });
    await updateVaultItemWithStore(fake, { ownerUserId: "user-a", id: "vault-1", input: patch });
    await archiveVaultItemWithStore(fake, { ownerUserId: "user-a", id: "vault-1" });

    expect(fake.list).toHaveBeenCalledWith("user-a");
    expect(fake.create).toHaveBeenCalledWith("user-a", createInput);
    expect(fake.get).toHaveBeenCalledWith("user-a", "vault-1");
    expect(fake.update).toHaveBeenCalledWith("user-a", "vault-1", patch);
    expect(fake.archive).toHaveBeenCalledWith("user-a", "vault-1");
  });
});

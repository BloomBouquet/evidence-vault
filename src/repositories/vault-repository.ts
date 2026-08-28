import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { vaultItems } from "@/src/db/schema";
import type { CreateVaultItemInput, UpdateVaultItemInput } from "@/src/domain/vault-item";

export type OwnedResourceKey = { ownerUserId: string; id: string };
export type OwnerKey = { ownerUserId: string };

export type VaultItemRecord = {
  id: string;
  userId: string;
  title: string;
  category: string;
  merchantName: string | null;
  purchaseOrStartDate: string;
  amount: number | null;
  currency: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type VaultStore = {
  list(ownerUserId: string): Promise<VaultItemRecord[]>;
  create(ownerUserId: string, input: CreateVaultItemInput): Promise<VaultItemRecord>;
  get(ownerUserId: string, id: string): Promise<VaultItemRecord | null>;
  update(ownerUserId: string, id: string, input: UpdateVaultItemInput): Promise<VaultItemRecord | null>;
  archive(ownerUserId: string, id: string): Promise<VaultItemRecord | null>;
};

const drizzleVaultStore: VaultStore = {
  async list(ownerUserId) {
    return getDb()
      .select()
      .from(vaultItems)
      .where(and(eq(vaultItems.userId, ownerUserId), eq(vaultItems.status, "active")))
      .orderBy(desc(vaultItems.updatedAt));
  },

  async create(ownerUserId, input) {
    const [row] = await getDb()
      .insert(vaultItems)
      .values({
        userId: ownerUserId,
        title: input.title,
        category: input.category,
        merchantName: input.merchantName ?? null,
        purchaseOrStartDate: input.purchaseOrStartDate,
        amount: input.amount ?? null,
        currency: input.currency,
        description: input.description ?? null,
      })
      .returning();
    return row;
  },

  async get(ownerUserId, id) {
    const [row] = await getDb()
      .select()
      .from(vaultItems)
      .where(and(eq(vaultItems.id, id), eq(vaultItems.userId, ownerUserId)))
      .limit(1);
    return row ?? null;
  },

  async update(ownerUserId, id, input) {
    const [row] = await getDb()
      .update(vaultItems)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(vaultItems.id, id), eq(vaultItems.userId, ownerUserId)))
      .returning();
    return row ?? null;
  },

  async archive(ownerUserId, id) {
    const [row] = await getDb()
      .update(vaultItems)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(vaultItems.id, id), eq(vaultItems.userId, ownerUserId)))
      .returning();
    return row ?? null;
  },
};

export function listVaultItemsWithStore(store: VaultStore, { ownerUserId }: OwnerKey) {
  return store.list(ownerUserId);
}

export function createVaultItemWithStore(
  store: VaultStore,
  { ownerUserId, input }: { ownerUserId: string; input: CreateVaultItemInput },
) {
  return store.create(ownerUserId, input);
}

export function getVaultItemWithStore(store: VaultStore, { ownerUserId, id }: OwnedResourceKey) {
  return store.get(ownerUserId, id);
}

export function updateVaultItemWithStore(
  store: VaultStore,
  { ownerUserId, id, input }: OwnedResourceKey & { input: UpdateVaultItemInput },
) {
  return store.update(ownerUserId, id, input);
}

export function archiveVaultItemWithStore(store: VaultStore, { ownerUserId, id }: OwnedResourceKey) {
  return store.archive(ownerUserId, id);
}

export function listVaultItems(input: OwnerKey) {
  return listVaultItemsWithStore(drizzleVaultStore, input);
}

export function createVaultItem(input: { ownerUserId: string; input: CreateVaultItemInput }) {
  return createVaultItemWithStore(drizzleVaultStore, input);
}

export function getVaultItem(input: OwnedResourceKey) {
  return getVaultItemWithStore(drizzleVaultStore, input);
}

export function updateVaultItem(input: OwnedResourceKey & { input: UpdateVaultItemInput }) {
  return updateVaultItemWithStore(drizzleVaultStore, input);
}

export function archiveVaultItem(input: OwnedResourceKey) {
  return archiveVaultItemWithStore(drizzleVaultStore, input);
}

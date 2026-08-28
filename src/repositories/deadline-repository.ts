import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { deadlines, vaultItems } from "@/src/db/schema";
import type { CreateDeadlineInput, UpdateDeadlineInput } from "@/src/domain/deadline";

export type DeadlineRecord = {
  id: string;
  vaultItemId: string;
  type: string;
  dueDate: string;
  sourceType: string;
  sourceNote: string | null;
  reminderState: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DeadlineStore = {
  ownsVault(ownerUserId: string, vaultItemId: string): Promise<boolean>;
  list(vaultItemId: string): Promise<DeadlineRecord[]>;
  create(vaultItemId: string, input: CreateDeadlineInput): Promise<DeadlineRecord | null>;
  update(vaultItemId: string, deadlineId: string, input: UpdateDeadlineInput): Promise<DeadlineRecord | null>;
  delete(vaultItemId: string, deadlineId: string): Promise<boolean>;
};

const drizzleDeadlineStore: DeadlineStore = {
  async ownsVault(ownerUserId, vaultItemId) {
    const [row] = await getDb()
      .select({ id: vaultItems.id })
      .from(vaultItems)
      .where(and(eq(vaultItems.id, vaultItemId), eq(vaultItems.userId, ownerUserId)))
      .limit(1);
    return Boolean(row);
  },

  async list(vaultItemId) {
    return getDb()
      .select()
      .from(deadlines)
      .where(eq(deadlines.vaultItemId, vaultItemId))
      .orderBy(asc(deadlines.dueDate), asc(deadlines.createdAt));
  },

  async create(vaultItemId, input) {
    const [row] = await getDb()
      .insert(deadlines)
      .values({
        vaultItemId,
        type: input.type,
        dueDate: input.dueDate,
        sourceType: input.sourceType,
        sourceNote: input.sourceNote ?? null,
      })
      .returning();
    return row ?? null;
  },

  async update(vaultItemId, deadlineId, input) {
    const [row] = await getDb()
      .update(deadlines)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(deadlines.id, deadlineId), eq(deadlines.vaultItemId, vaultItemId)))
      .returning();
    return row ?? null;
  },

  async delete(vaultItemId, deadlineId) {
    const rows = await getDb()
      .delete(deadlines)
      .where(and(eq(deadlines.id, deadlineId), eq(deadlines.vaultItemId, vaultItemId)))
      .returning({ id: deadlines.id });
    return rows.length > 0;
  },
};

export type DeadlineOwnerKey = { ownerUserId: string; vaultItemId: string };
export type DeadlineOwnedKey = DeadlineOwnerKey & { deadlineId: string };

export async function listDeadlinesWithStore(store: DeadlineStore, input: DeadlineOwnerKey) {
  if (!await store.ownsVault(input.ownerUserId, input.vaultItemId)) return null;
  return store.list(input.vaultItemId);
}

export async function createDeadlineWithStore(
  store: DeadlineStore,
  input: DeadlineOwnerKey & { input: CreateDeadlineInput },
) {
  if (!await store.ownsVault(input.ownerUserId, input.vaultItemId)) return null;
  return store.create(input.vaultItemId, input.input);
}

export async function updateDeadlineWithStore(
  store: DeadlineStore,
  input: DeadlineOwnedKey & { input: UpdateDeadlineInput },
) {
  if (!await store.ownsVault(input.ownerUserId, input.vaultItemId)) return null;
  return store.update(input.vaultItemId, input.deadlineId, input.input);
}

export async function deleteDeadlineWithStore(store: DeadlineStore, input: DeadlineOwnedKey) {
  if (!await store.ownsVault(input.ownerUserId, input.vaultItemId)) return null;
  return store.delete(input.vaultItemId, input.deadlineId);
}

function ownedVaultIds(ownerUserId: string, vaultItemId: string) {
  return getDb()
    .select({ id: vaultItems.id })
    .from(vaultItems)
    .where(and(eq(vaultItems.id, vaultItemId), eq(vaultItems.userId, ownerUserId)));
}

export async function listDeadlines({ ownerUserId, vaultItemId }: DeadlineOwnerKey) {
  const rows = await getDb()
    .select()
    .from(deadlines)
    .where(and(
      eq(deadlines.vaultItemId, vaultItemId),
      inArray(deadlines.vaultItemId, ownedVaultIds(ownerUserId, vaultItemId)),
    ))
    .orderBy(asc(deadlines.dueDate), asc(deadlines.createdAt));

  if (rows.length > 0) return rows;
  const owned = await drizzleDeadlineStore.ownsVault(ownerUserId, vaultItemId);
  return owned ? [] : null;
}

export async function createDeadline(input: DeadlineOwnerKey & { input: CreateDeadlineInput }) {
  return createDeadlineWithStore(drizzleDeadlineStore, input);
}

export async function updateDeadline({ ownerUserId, vaultItemId, deadlineId, input }: DeadlineOwnedKey & { input: UpdateDeadlineInput }) {
  const [row] = await getDb()
    .update(deadlines)
    .set({ ...input, updatedAt: new Date() })
    .where(and(
      eq(deadlines.id, deadlineId),
      eq(deadlines.vaultItemId, vaultItemId),
      inArray(deadlines.vaultItemId, ownedVaultIds(ownerUserId, vaultItemId)),
    ))
    .returning();
  return row ?? null;
}

export async function deleteDeadline({ ownerUserId, vaultItemId, deadlineId }: DeadlineOwnedKey) {
  const rows = await getDb()
    .delete(deadlines)
    .where(and(
      eq(deadlines.id, deadlineId),
      eq(deadlines.vaultItemId, vaultItemId),
      inArray(deadlines.vaultItemId, ownedVaultIds(ownerUserId, vaultItemId)),
    ))
    .returning({ id: deadlines.id });
  return rows.length > 0;
}

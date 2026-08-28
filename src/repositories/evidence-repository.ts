import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { evidenceFiles } from "@/src/db/schema";
import type { OwnedResourceKey } from "./vault-repository";

export type EvidenceFileRow = typeof evidenceFiles.$inferSelect;
export type NewEvidenceFile = typeof evidenceFiles.$inferInsert;

export type EvidenceFileStore = {
  getActive(ownerUserId: string, id: string): Promise<EvidenceFileRow | null>;
  create(input: NewEvidenceFile): Promise<EvidenceFileRow>;
  markDeleted(
    ownerUserId: string,
    id: string,
    deletedAt: Date,
  ): Promise<EvidenceFileRow | null>;
};

const drizzleEvidenceFileStore: EvidenceFileStore = {
  async getActive(ownerUserId, id) {
    const [row] = await getDb()
      .select()
      .from(evidenceFiles)
      .where(
        and(
          eq(evidenceFiles.id, id),
          eq(evidenceFiles.userId, ownerUserId),
          isNull(evidenceFiles.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async create(input) {
    const [row] = await getDb().insert(evidenceFiles).values(input).returning();
    if (!row) throw new Error("evidence_file_create_failed");
    return row;
  },

  async markDeleted(ownerUserId, id, deletedAt) {
    const [row] = await getDb()
      .update(evidenceFiles)
      .set({ deletedAt })
      .where(
        and(
          eq(evidenceFiles.id, id),
          eq(evidenceFiles.userId, ownerUserId),
          isNull(evidenceFiles.deletedAt),
        ),
      )
      .returning();
    return row ?? null;
  },
};

export function getEvidenceFileWithStore(
  store: EvidenceFileStore,
  { ownerUserId, id }: OwnedResourceKey,
) {
  return store.getActive(ownerUserId, id);
}

export function createEvidenceFileWithStore(
  store: EvidenceFileStore,
  input: NewEvidenceFile,
) {
  return store.create(input);
}

export function markEvidenceFileDeletedWithStore(
  store: EvidenceFileStore,
  input: OwnedResourceKey & { deletedAt: Date },
) {
  return store.markDeleted(input.ownerUserId, input.id, input.deletedAt);
}

export function getEvidenceFile(input: OwnedResourceKey) {
  return getEvidenceFileWithStore(drizzleEvidenceFileStore, input);
}

export function createEvidenceFile(input: NewEvidenceFile) {
  return createEvidenceFileWithStore(drizzleEvidenceFileStore, input);
}

export function markEvidenceFileDeleted(
  input: OwnedResourceKey & { deletedAt: Date },
) {
  return markEvidenceFileDeletedWithStore(drizzleEvidenceFileStore, input);
}

import { eq } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { deletionJobs } from "@/src/db/schema";

export type DeletionJobRow = typeof deletionJobs.$inferSelect;
export type DeletionJobStore = {
  create(input: typeof deletionJobs.$inferInsert): Promise<DeletionJobRow>;
  get(id: string): Promise<DeletionJobRow | null>;
  update(
    id: string,
    patch: Partial<Pick<DeletionJobRow, "status" | "attempts" | "lastErrorCode">>,
  ): Promise<DeletionJobRow | null>;
};

const drizzleDeletionJobStore: DeletionJobStore = {
  async create(input) {
    const [row] = await getDb().insert(deletionJobs).values(input).returning();
    if (!row) throw new Error("deletion_job_create_failed");
    return row;
  },

  async get(id) {
    const [row] = await getDb()
      .select()
      .from(deletionJobs)
      .where(eq(deletionJobs.id, id))
      .limit(1);
    return row ?? null;
  },

  async update(id, patch) {
    const [row] = await getDb()
      .update(deletionJobs)
      .set(patch)
      .where(eq(deletionJobs.id, id))
      .returning();
    return row ?? null;
  },
};

export function createDeletionJobWithStore(
  store: DeletionJobStore,
  input: Pick<DeletionJobRow, "id" | "userId" | "kind" | "targetId">,
) {
  return store.create({
    ...input,
    status: "queued",
    attempts: 0,
    lastErrorCode: null,
  });
}

export function getDeletionJobWithStore(store: DeletionJobStore, id: string) {
  return store.get(id);
}

export function markDeletionJobRetryableWithStore(
  store: DeletionJobStore,
  id: string,
  attempts: number,
  lastErrorCode: string,
) {
  return store.update(id, { status: "retryable", attempts, lastErrorCode });
}

export function markDeletionJobCompletedWithStore(
  store: DeletionJobStore,
  id: string,
  attempts: number,
) {
  return store.update(id, { status: "completed", attempts, lastErrorCode: null });
}

export function markDeletionJobBlockedWithStore(
  store: DeletionJobStore,
  id: string,
  attempts: number,
  lastErrorCode: string,
) {
  return store.update(id, { status: "blocked", attempts, lastErrorCode });
}

export function createDeletionJob(
  input: Pick<DeletionJobRow, "id" | "userId" | "kind" | "targetId">,
) {
  return createDeletionJobWithStore(drizzleDeletionJobStore, input);
}

export function getDeletionJob(id: string) {
  return getDeletionJobWithStore(drizzleDeletionJobStore, id);
}

export function markDeletionJobRetryable(
  id: string,
  attempts: number,
  lastErrorCode: string,
) {
  return markDeletionJobRetryableWithStore(
    drizzleDeletionJobStore,
    id,
    attempts,
    lastErrorCode,
  );
}

export function markDeletionJobCompleted(id: string, attempts: number) {
  return markDeletionJobCompletedWithStore(drizzleDeletionJobStore, id, attempts);
}

export function markDeletionJobBlocked(
  id: string,
  attempts: number,
  lastErrorCode: string,
) {
  return markDeletionJobBlockedWithStore(
    drizzleDeletionJobStore,
    id,
    attempts,
    lastErrorCode,
  );
}

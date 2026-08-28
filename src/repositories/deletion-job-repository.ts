import { and, eq } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { deletionJobs } from "@/src/db/schema";

export type DeletionJobRow = typeof deletionJobs.$inferSelect;
export type DeletionJobTarget = Pick<DeletionJobRow, "userId" | "kind" | "targetId">;
export type DeletionJobStore = {
  create(input: typeof deletionJobs.$inferInsert): Promise<DeletionJobRow>;
  get(id: string): Promise<DeletionJobRow | null>;
  findByTarget(input: DeletionJobTarget): Promise<DeletionJobRow | null>;
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

  async findByTarget({ userId, kind, targetId }) {
    const [row] = await getDb()
      .select()
      .from(deletionJobs)
      .where(
        and(
          eq(deletionJobs.userId, userId),
          eq(deletionJobs.kind, kind),
          eq(deletionJobs.targetId, targetId),
        ),
      )
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

export async function ensureDeletionJobWithStore(
  store: DeletionJobStore,
  input: Pick<DeletionJobRow, "id" | "userId" | "kind" | "targetId">,
) {
  const target = { userId: input.userId, kind: input.kind, targetId: input.targetId };
  const existing = await store.findByTarget(target);
  if (existing) return existing;

  try {
    return await store.create({
      ...input,
      status: "queued",
      attempts: 0,
      lastErrorCode: null,
    });
  } catch (error) {
    const raced = await store.findByTarget(target);
    if (raced) return raced;
    throw error;
  }
}

export function createDeletionJobWithStore(
  store: DeletionJobStore,
  input: Pick<DeletionJobRow, "id" | "userId" | "kind" | "targetId">,
) {
  return ensureDeletionJobWithStore(store, input);
}

export function getDeletionJobWithStore(store: DeletionJobStore, id: string) {
  return store.get(id);
}

export function markDeletionJobQueuedWithStore(
  store: DeletionJobStore,
  id: string,
  attempts: number,
  lastErrorCode: string,
) {
  return store.update(id, { status: "queued", attempts, lastErrorCode });
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

export function ensureDeletionJob(
  input: Pick<DeletionJobRow, "id" | "userId" | "kind" | "targetId">,
) {
  return ensureDeletionJobWithStore(drizzleDeletionJobStore, input);
}

export function createDeletionJob(
  input: Pick<DeletionJobRow, "id" | "userId" | "kind" | "targetId">,
) {
  return ensureDeletionJob(input);
}

export function getDeletionJob(id: string) {
  return getDeletionJobWithStore(drizzleDeletionJobStore, id);
}

export function markDeletionJobQueued(
  id: string,
  attempts: number,
  lastErrorCode: string,
) {
  return markDeletionJobQueuedWithStore(
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

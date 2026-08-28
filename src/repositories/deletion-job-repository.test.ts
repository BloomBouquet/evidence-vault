import { describe, expect, it, vi } from "vitest";
import {
  createDeletionJobWithStore,
  ensureDeletionJobWithStore,
  getDeletionJobWithStore,
  markDeletionJobBlockedWithStore,
  markDeletionJobCompletedWithStore,
  markDeletionJobQueuedWithStore,
  type DeletionJobStore,
} from "./deletion-job-repository";

const baseJob = {
  id: "job-1",
  userId: "user-a",
  kind: "evidence_file_object",
  targetId: "file-1",
  status: "queued",
  attempts: 0,
  lastErrorCode: null,
  createdAt: new Date("2026-08-28T00:00:00.000Z"),
  updatedAt: new Date("2026-08-28T00:00:00.000Z"),
};

function store(existing = false): DeletionJobStore {
  let current = { ...baseJob };
  return {
    create: vi.fn(async (input) => {
      current = { ...baseJob, ...input };
      return current;
    }),
    get: vi.fn(async (id) => (id === current.id ? current : null)),
    findByTarget: vi.fn(async ({ userId, kind, targetId }) =>
      existing && userId === current.userId && kind === current.kind && targetId === current.targetId
        ? current
        : null,
    ),
    update: vi.fn(async (id, patch) => {
      if (id !== current.id) return null;
      current = { ...current, ...patch };
      return current;
    }),
  };
}

describe("deletion job repository state", () => {
  it("creates a queued evidence-file-object job with owner and target", async () => {
    const fake = store();
    await createDeletionJobWithStore(fake, {
      id: "job-1",
      userId: "user-a",
      kind: "evidence_file_object",
      targetId: "file-1",
    });
    expect(fake.create).toHaveBeenCalledWith({
      id: "job-1",
      userId: "user-a",
      kind: "evidence_file_object",
      targetId: "file-1",
      status: "queued",
      attempts: 0,
      lastErrorCode: null,
    });
  });

  it("reuses an existing owner-kind-target job instead of creating a duplicate", async () => {
    const fake = store(true);
    await expect(ensureDeletionJobWithStore(fake, {
      id: "job-new",
      userId: "user-a",
      kind: "evidence_file_object",
      targetId: "file-1",
    })).resolves.toEqual(baseJob);
    expect(fake.create).not.toHaveBeenCalled();
  });

  it("records transient retry attempts as queued with normalized error codes", async () => {
    const fake = store();
    await expect(markDeletionJobQueuedWithStore(fake, "job-1", 2, "storage_transient")).resolves.toMatchObject({
      status: "queued",
      attempts: 2,
      lastErrorCode: "storage_transient",
    });
  });

  it("transitions completed and blocked states without inventing success", async () => {
    const fake = store();
    await expect(markDeletionJobCompletedWithStore(fake, "job-1", 1)).resolves.toMatchObject({ status: "completed", attempts: 1, lastErrorCode: null });
    await expect(markDeletionJobBlockedWithStore(fake, "job-1", 5, "storage_permanent")).resolves.toMatchObject({ status: "blocked", attempts: 5, lastErrorCode: "storage_permanent" });
    await expect(getDeletionJobWithStore(fake, "missing")).resolves.toBeNull();
  });
});

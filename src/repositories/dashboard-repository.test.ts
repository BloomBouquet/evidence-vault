import { describe, expect, it, vi } from "vitest";
import {
  getDashboardProjectionWithStore,
  type DashboardDeadlineCandidate,
  type DashboardEventCandidate,
  type DashboardStore,
  type DashboardVaultCandidate,
} from "./dashboard-repository";

const today = "2026-08-28";

function deadline(id: string, dueDate: string, overrides: Partial<DashboardDeadlineCandidate> = {}): DashboardDeadlineCandidate {
  return {
    id,
    vaultItemId: `vault-${id}`,
    vaultTitle: `기록 ${id}`,
    merchantName: null,
    type: "custom",
    dueDate,
    sourceType: "user_entered",
    sourceNote: null,
    vaultStatus: "active",
    reminderState: "active",
    createdAt: new Date(`2026-08-01T00:00:00Z`),
    ...overrides,
  };
}

function event(id: string, occurredOn: string, createdAt: string, overrides: Partial<DashboardEventCandidate> = {}): DashboardEventCandidate {
  return {
    id,
    vaultItemId: `vault-${id}`,
    vaultTitle: `기록 ${id}`,
    occurredOn,
    eventType: "custom",
    title: `이벤트 ${id}`,
    vaultStatus: "active",
    createdAt: new Date(createdAt),
    ...overrides,
  };
}

function vault(id: string, updatedAt: string, status = "active"): DashboardVaultCandidate {
  return {
    id,
    title: `기록 ${id}`,
    category: "other",
    merchantName: null,
    purchaseOrStartDate: "2026-08-01",
    amount: null,
    currency: "KRW",
    description: null,
    status,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date(updatedAt),
  };
}

function makeStore(overrides: Partial<DashboardStore> = {}): DashboardStore {
  return {
    loadDeadlineCandidates: vi.fn(async () => []),
    loadEventCandidates: vi.fn(async () => []),
    loadVaultCandidates: vi.fn(async () => []),
    ...overrides,
  };
}

describe("dashboard projection", () => {
  it("returns honest empty arrays and passes owner-scoped query inputs", async () => {
    const store = makeStore();
    await expect(getDashboardProjectionWithStore(store, { ownerUserId: "user-a", today })).resolves.toEqual({
      upcomingDeadlines: [],
      recentEvents: [],
      vaultItems: [],
    });

    expect(store.loadDeadlineCandidates).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      today,
      recentOverdueStart: "2026-08-21",
      limit: 10,
    });
    expect(store.loadEventCandidates).toHaveBeenCalledWith({ ownerUserId: "user-a", limit: 10 });
    expect(store.loadVaultCandidates).toHaveBeenCalledWith({ ownerUserId: "user-a", limit: 20 });
  });

  it("applies the recent-overdue window, queue ordering, active filters, and limits", async () => {
    const deadlines = [
      deadline("old", "2026-08-20"),
      deadline("d21", "2026-08-21"),
      deadline("d26", "2026-08-26"),
      deadline("d27", "2026-08-27"),
      deadline("today", "2026-08-28"),
      deadline("future1", "2026-08-29"),
      deadline("future2", "2026-09-01"),
      deadline("future3", "2026-09-02"),
      deadline("future4", "2026-09-03"),
      deadline("future5", "2026-09-04"),
      deadline("future6", "2026-09-05"),
      deadline("future7", "2026-09-06"),
      deadline("future8", "2026-09-07"),
      deadline("archived", "2026-08-28", { vaultStatus: "archived" }),
      deadline("inactive-reminder", "2026-08-28", { reminderState: "dismissed" }),
    ];

    const events = Array.from({ length: 11 }, (_, index) => {
      const day = String(17 + index).padStart(2, "0");
      return event(`event-${index + 1}`, `2026-08-${day}`, `2026-08-${day}T12:00:00Z`);
    });
    events.push(event("archived-event", "2026-08-28", "2026-08-28T13:00:00Z", { vaultStatus: "archived" }));

    const vaults = Array.from({ length: 21 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return vault(`vault-${index + 1}`, `2026-08-${day}T00:00:00Z`);
    });
    vaults.push(vault("archived-vault", "2026-08-31T00:00:00Z", "archived"));

    const projection = await getDashboardProjectionWithStore(
      makeStore({
        loadDeadlineCandidates: vi.fn(async () => deadlines),
        loadEventCandidates: vi.fn(async () => events),
        loadVaultCandidates: vi.fn(async () => vaults),
      }),
      { ownerUserId: "user-a", today },
    );

    expect(projection.upcomingDeadlines.map((row) => row.id)).toEqual([
      "d27",
      "d26",
      "d21",
      "today",
      "future1",
      "future2",
      "future3",
      "future4",
      "future5",
      "future6",
    ]);
    expect(projection.upcomingDeadlines).toHaveLength(10);
    expect(projection.upcomingDeadlines.every((row) => !("vaultStatus" in row) && !("reminderState" in row))).toBe(true);

    expect(projection.recentEvents).toHaveLength(10);
    expect(projection.recentEvents[0].id).toBe("event-11");
    expect(projection.recentEvents.at(-1)?.id).toBe("event-2");
    expect(projection.recentEvents.some((row) => row.id === "archived-event")).toBe(false);
    expect(projection.recentEvents.every((row) => !("createdAt" in row) && !("vaultStatus" in row))).toBe(true);

    expect(projection.vaultItems).toHaveLength(20);
    expect(projection.vaultItems[0].id).toBe("vault-21");
    expect(projection.vaultItems.at(-1)?.id).toBe("vault-2");
    expect(projection.vaultItems.some((row) => row.id === "archived-vault")).toBe(false);
  });
});

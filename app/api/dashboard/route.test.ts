import { describe, expect, it, vi } from "vitest";
import { createDashboardResponse, type DashboardDependencies } from "./route";

const emptyProjection = {
  upcomingDeadlines: [],
  recentEvents: [],
  vaultItems: [],
};

function deps(overrides: Partial<DashboardDependencies> = {}): DashboardDependencies {
  return {
    resolveUser: vi.fn(async () => ({ id: "user-a", displayName: "순우" })),
    getProjection: vi.fn(async () => emptyProjection),
    ...overrides,
  };
}

describe("dashboard API", () => {
  it("requires authentication", async () => {
    const response = await createDashboardResponse(
      new Request("https://vault.example.com/api/dashboard"),
      deps({ resolveUser: vi.fn(async () => null) }),
      "2026-08-28",
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "authentication_required" });
  });

  it("derives owner from the session and returns honest empty arrays with no-store", async () => {
    const dependencies = deps();
    const response = await createDashboardResponse(
      new Request("https://vault.example.com/api/dashboard"),
      dependencies,
      "2026-08-28",
    );

    expect(dependencies.getProjection).toHaveBeenCalledWith({ ownerUserId: "user-a", today: "2026-08-28" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual(emptyProjection);
  });

  it("returns the repository projection without adding fake metrics", async () => {
    const projection = {
      upcomingDeadlines: [{
        id: "deadline-1",
        vaultItemId: "vault-1",
        vaultTitle: "노트북 구매",
        merchantName: null,
        type: "custom",
        dueDate: "2026-08-29",
        sourceType: "user_entered",
        sourceNote: null,
      }],
      recentEvents: [{
        id: "event-1",
        vaultItemId: "vault-1",
        vaultTitle: "노트북 구매",
        occurredOn: "2026-08-28",
        eventType: "custom",
        title: "판매자에게 문의",
      }],
      vaultItems: [],
    };
    const response = await createDashboardResponse(
      new Request("https://vault.example.com/api/dashboard"),
      deps({ getProjection: vi.fn(async () => projection) }),
      "2026-08-28",
    );
    const body = await response.json();
    expect(body).toEqual(projection);
    expect(body).not.toHaveProperty("readiness");
    expect(body).not.toHaveProperty("legalRisk");
    expect(body).not.toHaveProperty("refundProbability");
  });

  it("normalizes repository failures without leaking raw errors", async () => {
    const response = await createDashboardResponse(
      new Request("https://vault.example.com/api/dashboard"),
      deps({ getProjection: vi.fn(async () => { throw new Error("postgres password=secret"); }) }),
      "2026-08-28",
    );
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: "internal_error" });
    expect(text).not.toContain("postgres");
    expect(text).not.toContain("secret");
  });
});

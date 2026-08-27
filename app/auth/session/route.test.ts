import { describe, expect, it, vi } from "vitest";
import { createSessionProbeResponse, type SessionProbeDependencies } from "./route";

function deps(overrides: Partial<SessionProbeDependencies> = {}): SessionProbeDependencies {
  return {
    resolveSession: vi.fn(async () => null),
    ...overrides,
  };
}

describe("createSessionProbeResponse", () => {
  it("returns user null for a missing session without redirecting", async () => {
    const dependencies = deps();
    const response = await createSessionProbeResponse(
      new Request("https://vault.example.com/auth/session"),
      dependencies,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ user: null });
    expect(dependencies.resolveSession).toHaveBeenCalledWith(null);
  });

  it("returns only safe local user fields for a valid session", async () => {
    const dependencies = deps({
      resolveSession: vi.fn(async () => ({ id: "user-1", displayName: "순우" })),
    });
    const response = await createSessionProbeResponse(
      new Request("https://vault.example.com/auth/session", {
        headers: { cookie: "other=value; ev_session=raw-project-session" },
      }),
      dependencies,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ user: { id: "user-1", displayName: "순우" } });
    expect(text).not.toContain("raw-project-session");
    expect(text).not.toContain("access_token");
    expect(text).not.toContain("codeVerifier");
    expect(dependencies.resolveSession).toHaveBeenCalledWith("raw-project-session");
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  createProjectSessionWithStore,
  hashSessionToken,
  resolveProjectSessionWithStore,
  revokeProjectSessionWithStore,
  type ProjectSessionStore,
} from "./project-session";

function store(overrides: Partial<ProjectSessionStore> = {}): ProjectSessionStore {
  return {
    create: vi.fn(async () => undefined),
    find: vi.fn(async () => null),
    revoke: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("project session", () => {
  it("hashes raw tokens as deterministic 64-character SHA-256 hex", () => {
    const hash = hashSessionToken("raw-session-token");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken("raw-session-token")).toBe(hash);
    expect(hash).not.toContain("raw-session-token");
  });

  it("creates a 32-byte opaque token and persists only its hash", async () => {
    const adapter = store();
    const now = new Date("2026-08-28T00:00:00Z");
    const result = await createProjectSessionWithStore(adapter, "user-1", now);
    expect(Buffer.from(result.rawToken, "base64url")).toHaveLength(32);
    expect(result.expiresAt.toISOString()).toBe("2026-09-04T00:00:00.000Z");
    expect(adapter.create).toHaveBeenCalledWith({
      userId: "user-1",
      tokenHash: hashSessionToken(result.rawToken),
      expiresAt: result.expiresAt,
    });
    expect(JSON.stringify(vi.mocked(adapter.create).mock.calls)).not.toContain(result.rawToken);
  });

  it("returns only safe user fields for an active session", async () => {
    const adapter = store({
      find: vi.fn(async () => ({
        user: { id: "user-1", displayName: "순우" },
      })),
    });
    await expect(
      resolveProjectSessionWithStore(adapter, "raw-session-token", new Date("2026-08-28T00:00:00Z")),
    ).resolves.toEqual({ id: "user-1", displayName: "순우" });
    expect(adapter.find).toHaveBeenCalledWith(
      hashSessionToken("raw-session-token"),
      new Date("2026-08-28T00:00:00Z"),
    );
  });

  it("returns null when the repository rejects the session", async () => {
    const adapter = store({ find: vi.fn(async () => null) });
    await expect(resolveProjectSessionWithStore(adapter, "expired-or-revoked")).resolves.toBeNull();
    await expect(resolveProjectSessionWithStore(adapter, null)).resolves.toBeNull();
  });

  it("revokes only the hash and is safe for a missing token", async () => {
    const adapter = store();
    await revokeProjectSessionWithStore(adapter, "raw-session-token");
    expect(adapter.revoke).toHaveBeenCalledWith(hashSessionToken("raw-session-token"));
    await revokeProjectSessionWithStore(adapter, null);
    expect(adapter.revoke).toHaveBeenCalledTimes(1);
  });
});

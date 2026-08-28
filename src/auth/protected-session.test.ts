import { describe, expect, it, vi } from "vitest";
import { resolveProtectedUser } from "./protected-session";

describe("resolveProtectedUser", () => {
  it("returns null without a project session token", async () => {
    const resolver = vi.fn();

    await expect(resolveProtectedUser(null, resolver)).resolves.toBeNull();
    expect(resolver).not.toHaveBeenCalled();
  });

  it("returns only safe local user fields for a valid session", async () => {
    const resolver = vi.fn(async () => ({
      id: "user-1",
      displayName: "순우",
      tokenHash: "must-not-escape",
    }));

    await expect(resolveProtectedUser("raw-project-session", resolver)).resolves.toEqual({
      id: "user-1",
      displayName: "순우",
    });
    expect(resolver).toHaveBeenCalledWith("raw-project-session");
  });

  it("returns null when the project-session resolver rejects the session", async () => {
    const resolver = vi.fn(async () => null);

    await expect(resolveProtectedUser("expired-session", resolver)).resolves.toBeNull();
  });
});

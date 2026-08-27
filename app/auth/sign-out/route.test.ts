import { describe, expect, it, vi } from "vitest";
import { createSignOutResponse, type SignOutDependencies } from "./route";

function deps(overrides: Partial<SignOutDependencies> = {}): SignOutDependencies {
  return {
    revokeSession: vi.fn(async () => undefined),
    secureCookies: true,
    ...overrides,
  };
}

describe("createSignOutResponse", () => {
  it("revokes the current project session and clears the cookie", async () => {
    const dependencies = deps();
    const response = await createSignOutResponse(
      new Request("https://vault.example.com/auth/sign-out", {
        method: "POST",
        headers: { cookie: "ev_session=raw-project-session" },
      }),
      dependencies,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(dependencies.revokeSession).toHaveBeenCalledWith("raw-project-session");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("ev_session=");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toContain("Path=/");
    expect(cookie).toMatch(/Max-Age=0/);
  });

  it("is idempotent when no application session cookie exists", async () => {
    const dependencies = deps();
    const response = await createSignOutResponse(
      new Request("https://vault.example.com/auth/sign-out", { method: "POST" }),
      dependencies,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(dependencies.revokeSession).toHaveBeenCalledWith(null);
    expect(response.headers.get("set-cookie") ?? "").toMatch(/Max-Age=0/);
  });
});

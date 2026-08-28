import { describe, expect, it, vi } from "vitest";
import { readCookie, resolveApiUser } from "./api-auth";

describe("api auth", () => {
  it("reads only the requested cookie", () => {
    const request = new Request("https://vault.example.com/api/vault-items", {
      headers: { cookie: "other=x; ev_session=raw%20token" },
    });
    expect(readCookie(request, "ev_session")).toBe("raw token");
  });

  it("resolves the project session server-side", async () => {
    const resolver = vi.fn(async () => ({ id: "user-1", displayName: "순우" }));
    const request = new Request("https://vault.example.com/api/vault-items", {
      headers: { cookie: "ev_session=raw-token" },
    });
    await expect(resolveApiUser(request, resolver)).resolves.toEqual({ id: "user-1", displayName: "순우" });
    expect(resolver).toHaveBeenCalledWith("raw-token");
  });
});

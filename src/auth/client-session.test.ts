import { describe, expect, it, vi } from "vitest";
import { probeSession } from "./client-session";

describe("probeSession", () => {
  it("maps user null to anonymous", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ user: null }), { status: 200 })) as unknown as typeof fetch;

    await expect(probeSession(fetchImpl)).resolves.toEqual({ status: "anonymous" });
    expect(fetchImpl).toHaveBeenCalledWith("/auth/session", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });
  });

  it("returns only safe local identity fields for an authenticated session", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      user: {
        id: "user-1",
        displayName: "순우",
        accessToken: "must-not-escape",
      },
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(probeSession(fetchImpl)).resolves.toEqual({
      status: "authenticated",
      user: { id: "user-1", displayName: "순우" },
    });
  });

  it.each([
    ["non-2xx", () => new Response("provider detail", { status: 500 })],
    ["non-json", () => new Response("not-json", { status: 200 })],
    ["invalid user", () => new Response(JSON.stringify({ user: { id: "", displayName: "" } }), { status: 200 })],
    ["missing user key", () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })],
  ])("normalizes %s responses", async (_name, responseFactory) => {
    const fetchImpl = vi.fn(async () => responseFactory()) as unknown as typeof fetch;

    await expect(probeSession(fetchImpl)).rejects.toThrow("session_probe_failed");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { AuthConfig } from "@/src/auth/config";
import { createBouquetCallbackResponse, type CallbackDependencies } from "./route";

const config: AuthConfig = {
  appBaseUrl: new URL("https://vault.example.com"),
  bouquetBaseUrl: new URL("https://id.example.com"),
  bouquetClientId: "evidence-vault",
  bouquetRedirectUri: new URL("https://vault.example.com/auth/bouquet/callback"),
  sessionSecret: "01234567890123456789012345678901",
  secureCookies: true,
};

function deps(overrides: Partial<CallbackDependencies> = {}): CallbackDependencies {
  return {
    config,
    openAttempt: vi.fn(() => ({
      state: "expected-state",
      verifier: "server-only-verifier",
      returnTo: "/vault/item-1?tab=timeline",
      expiresAt: 1_800_000_600_000,
    })),
    statesMatch: vi.fn((expected, actual) => expected === actual),
    exchangeCode: vi.fn(async () => ({ accessToken: "provider-access-secret", expiresIn: 900 })),
    fetchUserInfo: vi.fn(async () => ({ sub: "subject-1", name: "순우" })),
    upsertUser: vi.fn(async () => ({ id: "user-1", identitySubject: "subject-1", displayName: "순우" })),
    createSession: vi.fn(async () => ({
      rawToken: "project-session-secret",
      expiresAt: new Date("2026-09-04T00:00:00Z"),
    })),
    now: () => new Date("2026-08-28T00:00:00Z"),
    ...overrides,
  };
}

function callbackRequest(query = "code=one-time-code&state=expected-state", cookie = "ev_oauth_attempt=sealed-attempt") {
  return new Request(`https://vault.example.com/auth/bouquet/callback?${query}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

function setCookieHeader(response: Response) {
  return response.headers.get("set-cookie") ?? "";
}

function expectPrivacyHeaders(response: Response) {
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
}

describe("createBouquetCallbackResponse", () => {
  it("verifies provider identity before creating a local project session", async () => {
    const dependencies = deps();
    const response = await createBouquetCallbackResponse(callbackRequest(), dependencies);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://vault.example.com/vault/item-1?tab=timeline");
    expectPrivacyHeaders(response);
    expect(dependencies.openAttempt).toHaveBeenCalledWith("sealed-attempt", config.sessionSecret);
    expect(dependencies.statesMatch).toHaveBeenCalledWith("expected-state", "expected-state");
    expect(dependencies.exchangeCode).toHaveBeenCalledWith(config, {
      code: "one-time-code",
      verifier: "server-only-verifier",
    });
    expect(dependencies.fetchUserInfo).toHaveBeenCalledWith(config, "provider-access-secret");
    expect(dependencies.upsertUser).toHaveBeenCalledWith({ identitySubject: "subject-1", displayName: "순우" });
    expect(dependencies.createSession).toHaveBeenCalledWith("user-1");

    const cookies = setCookieHeader(response);
    expect(cookies).toContain("ev_session=project-session-secret");
    expect(cookies).toMatch(/HttpOnly/i);
    expect(cookies).toMatch(/Secure/i);
    expect(cookies).toMatch(/SameSite=Lax/i);
    expect(cookies).toContain("Path=/");
    expect(cookies).toContain("ev_oauth_attempt=");
    expect(cookies).toMatch(/Max-Age=0/);
    expect(response.headers.get("location")).not.toContain("provider-access-secret");
    expect(response.headers.get("location")).not.toContain("server-only-verifier");
  });

  it.each([
    ["missing code", callbackRequest("state=expected-state")],
    ["missing state", callbackRequest("code=one-time-code")],
    ["missing attempt", callbackRequest("code=one-time-code&state=expected-state", "")],
  ])("fails coarsely for %s", async (_name, request) => {
    const dependencies = deps();
    const response = await createBouquetCallbackResponse(request, dependencies);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://vault.example.com/?auth_error=oauth_failed");
    expectPrivacyHeaders(response);
    expect(setCookieHeader(response)).toContain("ev_oauth_attempt=");
    expect(setCookieHeader(response)).toMatch(/Max-Age=0/);
    expect(dependencies.createSession).not.toHaveBeenCalled();
  });

  it("rejects state mismatch before code exchange", async () => {
    const dependencies = deps({ statesMatch: vi.fn(() => false) });
    const response = await createBouquetCallbackResponse(callbackRequest(), dependencies);
    expect(response.headers.get("location")).toBe("https://vault.example.com/?auth_error=oauth_failed");
    expectPrivacyHeaders(response);
    expect(dependencies.exchangeCode).not.toHaveBeenCalled();
    expect(dependencies.createSession).not.toHaveBeenCalled();
  });

  it.each([
    ["tampered attempt", { openAttempt: vi.fn(() => { throw new Error("oauth_attempt_invalid"); }) }],
    ["token failure", { exchangeCode: vi.fn(async () => { throw new Error("bouquet_token_exchange_failed"); }) }],
    ["userinfo failure", { fetchUserInfo: vi.fn(async () => { throw new Error("bouquet_userinfo_failed"); }) }],
    ["deleted account", { upsertUser: vi.fn(async () => { throw new Error("account_deleted"); }) }],
  ])("normalizes %s without leaking provider values", async (_name, override) => {
    const dependencies = deps(override as Partial<CallbackDependencies>);
    const response = await createBouquetCallbackResponse(callbackRequest(), dependencies);
    const visible = `${response.headers.get("location")} ${setCookieHeader(response)}`;
    expect(response.headers.get("location")).toBe("https://vault.example.com/?auth_error=oauth_failed");
    expectPrivacyHeaders(response);
    expect(visible).not.toContain("one-time-code");
    expect(visible).not.toContain("server-only-verifier");
    expect(visible).not.toContain("provider-access-secret");
    expect(dependencies.createSession).not.toHaveBeenCalled();
  });
});

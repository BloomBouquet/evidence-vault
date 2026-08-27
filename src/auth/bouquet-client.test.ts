import { describe, expect, it, vi } from "vitest";
import type { AuthConfig } from "./config";
import {
  buildBouquetPortalUrl,
  exchangeBouquetCode,
  fetchBouquetUserInfo,
} from "./bouquet-client";

const config: AuthConfig = {
  appBaseUrl: new URL("https://vault.example.com"),
  bouquetBaseUrl: new URL("https://id.example.com"),
  bouquetClientId: "evidence-vault",
  bouquetRedirectUri: new URL("https://vault.example.com/auth/bouquet/callback"),
  sessionSecret: "01234567890123456789012345678901",
  secureCookies: true,
};

describe("buildBouquetPortalUrl", () => {
  it("builds the central portal URL with the OAuth request contract", () => {
    const url = buildBouquetPortalUrl(config, { state: "state-value", challenge: "challenge-value" });
    expect(url.origin).toBe("https://id.example.com");
    expect(url.pathname).toBe("/bloom/");
    expect(url.searchParams.get("mode")).toBe("auth");
    expect(url.searchParams.get("client_id")).toBe("evidence-vault");
    expect(url.searchParams.get("redirect_uri")).toBe("https://vault.example.com/auth/bouquet/callback");
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-value");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.toString()).not.toContain("verifier");
  });
});

describe("exchangeBouquetCode", () => {
  it("posts the configured JSON token-exchange contract", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(String(_input)).toBe("https://id.example.com/api/bouquet/oauth/token");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "content-type": "application/json" });
      expect(JSON.parse(String(init?.body))).toEqual({
        clientId: "evidence-vault",
        code: "one-time-code",
        redirectUri: "https://vault.example.com/auth/bouquet/callback",
        codeVerifier: "server-verifier",
      });
      return new Response(JSON.stringify({ access_token: "access-secret", expires_in: 900 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    await expect(
      exchangeBouquetCode(config, { code: "one-time-code", verifier: "server-verifier" }, fetchImpl),
    ).resolves.toEqual({ accessToken: "access-secret", expiresIn: 900 });
  });

  it("normalizes provider failures without embedding secrets", async () => {
    const fetchImpl = vi.fn(async () => new Response("provider leaked body access-secret", { status: 400 })) as unknown as typeof fetch;
    await expect(
      exchangeBouquetCode(config, { code: "one-time-code", verifier: "server-verifier" }, fetchImpl),
    ).rejects.toThrow("bouquet_token_exchange_failed");
  });
});

describe("fetchBouquetUserInfo", () => {
  it("requests userinfo with a Bearer token and returns only sub/name", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(String(_input)).toBe("https://id.example.com/api/bouquet/oauth/userinfo");
      expect(init?.headers).toEqual({ authorization: "Bearer access-secret" });
      return new Response(JSON.stringify({ sub: "subject-1", email: "ignored@example.com", name: "순우" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    await expect(fetchBouquetUserInfo(config, "access-secret", fetchImpl)).resolves.toEqual({
      sub: "subject-1",
      name: "순우",
    });
  });

  it("normalizes malformed userinfo", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ email: "ignored@example.com" }), { status: 200 })) as unknown as typeof fetch;
    await expect(fetchBouquetUserInfo(config, "access-secret", fetchImpl)).rejects.toThrow("bouquet_userinfo_failed");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { AuthConfig } from "@/src/auth/config";
import { createLoginStartResponse } from "./route";

const productionConfig: AuthConfig = {
  appBaseUrl: new URL("https://vault.example.com"),
  bouquetBaseUrl: new URL("https://id.example.com"),
  bouquetClientId: "evidence-vault",
  bouquetRedirectUri: new URL("https://vault.example.com/auth/bouquet/callback"),
  sessionSecret: "01234567890123456789012345678901",
  secureCookies: true,
};

function dependencies() {
  return {
    config: productionConfig,
    createAttempt: () => ({
      state: "state-value",
      challenge: "challenge-value",
      verifier: "server-only-verifier",
    }),
    sealAttempt: vi.fn(() => "sealed-attempt"),
    now: () => 1_800_000_000_000,
  };
}

describe("createLoginStartResponse", () => {
  it("redirects to the central portal and stores the verifier only in the sealed attempt", () => {
    const deps = dependencies();
    const response = createLoginStartResponse(
      new Request("https://vault.example.com/auth/bouquet/start?returnTo=%2Fvault%2Fitem-1%3Ftab%3Dtimeline"),
      deps,
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const url = new URL(location!);
    expect(url.origin).toBe("https://id.example.com");
    expect(url.pathname).toBe("/bloom/");
    expect(url.searchParams.get("mode")).toBe("auth");
    expect(url.searchParams.get("client_id")).toBe("evidence-vault");
    expect(url.searchParams.get("redirect_uri")).toBe("https://vault.example.com/auth/bouquet/callback");
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-value");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location).not.toContain("server-only-verifier");

    expect(deps.sealAttempt).toHaveBeenCalledWith(
      {
        state: "state-value",
        verifier: "server-only-verifier",
        returnTo: "/vault/item-1?tab=timeline",
        expiresAt: 1_800_000_600_000,
      },
      productionConfig.sessionSecret,
    );

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("ev_oauth_attempt=sealed-attempt");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toContain("Path=/auth/bouquet");
    expect(cookie).toContain("Max-Age=600");
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example/steal",
  ])("falls back to dashboard for unsafe returnTo %s", (returnTo) => {
    const deps = dependencies();
    createLoginStartResponse(
      new Request(`https://vault.example.com/auth/bouquet/start?returnTo=${encodeURIComponent(returnTo)}`),
      deps,
    );
    expect(deps.sealAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ returnTo: "/dashboard" }),
      productionConfig.sessionSecret,
    );
  });
});

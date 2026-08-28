import { describe, expect, it } from "vitest";
import { getAuthConfig } from "./config";

const validEnv = {
  NODE_ENV: "development",
  APP_BASE_URL: "http://localhost:3000/apps/evidence-vault/",
  BOUQUET_BASE_URL: "http://localhost:8080",
  BOUQUET_CLIENT_ID: "evidence-vault-local",
  BOUQUET_REDIRECT_URI: "http://localhost:3000/apps/evidence-vault/auth/bouquet/callback",
  SESSION_SECRET: "01234567890123456789012345678901",
} as NodeJS.ProcessEnv;

describe("getAuthConfig", () => {
  it("parses the valid development contract", () => {
    const config = getAuthConfig(validEnv);
    expect(config.appBaseUrl.toString()).toBe("http://localhost:3000/apps/evidence-vault/");
    expect(config.bouquetBaseUrl.toString()).toBe("http://localhost:8080/");
    expect(config.bouquetClientId).toBe("evidence-vault-local");
    expect(config.bouquetRedirectUri.toString()).toBe(
      "http://localhost:3000/apps/evidence-vault/auth/bouquet/callback",
    );
    expect(config.secureCookies).toBe(false);
  });

  it("accepts only the approved path-hosted production URLs", () => {
    const config = getAuthConfig({
      ...validEnv,
      NODE_ENV: "production",
      APP_BASE_URL: "https://bloombouquet.https.gsmsv.site/apps/evidence-vault/",
      BOUQUET_BASE_URL: "https://bloombouquet.https.gsmsv.site",
      BOUQUET_CLIENT_ID: "bouquet-submission-123",
      BOUQUET_REDIRECT_URI: "https://bloombouquet.https.gsmsv.site/apps/evidence-vault/auth/bouquet/callback",
    } as NodeJS.ProcessEnv);

    expect(config.appBaseUrl.toString()).toBe(
      "https://bloombouquet.https.gsmsv.site/apps/evidence-vault/",
    );
    expect(config.bouquetBaseUrl.toString()).toBe("https://bloombouquet.https.gsmsv.site/");
    expect(config.bouquetRedirectUri.toString()).toBe(
      "https://bloombouquet.https.gsmsv.site/apps/evidence-vault/auth/bouquet/callback",
    );
    expect(config.secureCookies).toBe(true);
  });

  it.each([
    ["missing client id", { ...validEnv, BOUQUET_CLIENT_ID: "" }],
    ["invalid app url", { ...validEnv, APP_BASE_URL: "not-a-url" }],
    ["short secret", { ...validEnv, SESSION_SECRET: "short" }],
    ["wrong callback path", { ...validEnv, BOUQUET_REDIRECT_URI: "http://localhost:3000/not-callback" }],
    ["non-http provider", { ...validEnv, BOUQUET_BASE_URL: "ftp://example.com" }],
  ])("rejects %s", (_name, env) => {
    expect(() => getAuthConfig(env as NodeJS.ProcessEnv)).toThrow("auth_config_invalid");
  });

  it.each([
    ["app", { ...validEnv, NODE_ENV: "production", APP_BASE_URL: "http://app.example.com/apps/evidence-vault/" }],
    ["provider", { ...validEnv, NODE_ENV: "production", BOUQUET_BASE_URL: "http://id.example.com" }],
    ["callback", { ...validEnv, NODE_ENV: "production", BOUQUET_REDIRECT_URI: "http://app.example.com/apps/evidence-vault/auth/bouquet/callback" }],
  ])("requires HTTPS for production %s URL", (_name, env) => {
    expect(() => getAuthConfig(env as NodeJS.ProcessEnv)).toThrow("auth_config_invalid");
  });

  it.each([
    ["standalone app origin", {
      ...validEnv,
      NODE_ENV: "production",
      APP_BASE_URL: "https://evidence-vault.https.gsmsv.site/",
      BOUQUET_BASE_URL: "https://bloombouquet.https.gsmsv.site",
      BOUQUET_REDIRECT_URI: "https://evidence-vault.https.gsmsv.site/auth/bouquet/callback",
    }],
    ["unprefixed callback", {
      ...validEnv,
      NODE_ENV: "production",
      APP_BASE_URL: "https://bloombouquet.https.gsmsv.site/apps/evidence-vault/",
      BOUQUET_BASE_URL: "https://bloombouquet.https.gsmsv.site",
      BOUQUET_REDIRECT_URI: "https://bloombouquet.https.gsmsv.site/auth/bouquet/callback",
    }],
    ["wrong production provider", {
      ...validEnv,
      NODE_ENV: "production",
      APP_BASE_URL: "https://bloombouquet.https.gsmsv.site/apps/evidence-vault/",
      BOUQUET_BASE_URL: "https://other.example.com",
      BOUQUET_REDIRECT_URI: "https://bloombouquet.https.gsmsv.site/apps/evidence-vault/auth/bouquet/callback",
    }],
  ])("rejects %s", (_name, env) => {
    expect(() => getAuthConfig(env as NodeJS.ProcessEnv)).toThrow("auth_config_invalid");
  });
});

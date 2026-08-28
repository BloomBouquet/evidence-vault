import { describe, expect, it } from "vitest";
import { getCurrentPolicyVersions } from "./config";

describe("getCurrentPolicyVersions", () => {
  it("returns trimmed server-owned versions", () => {
    expect(
      getCurrentPolicyVersions({
        NODE_ENV: "test",
        TERMS_VERSION: " terms-v1 ",
        PRIVACY_VERSION: " privacy-v1 ",
      } as NodeJS.ProcessEnv),
    ).toEqual({
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
    });
  });

  it.each([
    { NODE_ENV: "test", TERMS_VERSION: "", PRIVACY_VERSION: "privacy-v1" },
    { NODE_ENV: "test", TERMS_VERSION: "terms-v1", PRIVACY_VERSION: "" },
    { NODE_ENV: "test", TERMS_VERSION: "x".repeat(65), PRIVACY_VERSION: "privacy-v1" },
    { NODE_ENV: "test", TERMS_VERSION: "terms-v1", PRIVACY_VERSION: "x".repeat(65) },
  ])("rejects invalid policy config: %o", (env) => {
    expect(() => getCurrentPolicyVersions(env as NodeJS.ProcessEnv)).toThrow(
      "onboarding_config_invalid",
    );
  });
});

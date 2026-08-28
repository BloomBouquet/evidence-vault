import { describe, expect, it } from "vitest";
import { APP_BASE_PATH, appPath, appUrl } from "./app-path";

describe("Evidence Vault public app path", () => {
  it("uses the fixed BloomBouquet project prefix", () => {
    expect(APP_BASE_PATH).toBe("/apps/evidence-vault");
    expect(appPath("/")).toBe("/apps/evidence-vault/");
    expect(appPath("/dashboard")).toBe("/apps/evidence-vault/dashboard");
    expect(appPath("/auth/session?retry=1")).toBe("/apps/evidence-vault/auth/session?retry=1");
  });

  it("builds absolute URLs without escaping the project path", () => {
    expect(appUrl("https://bloombouquet.https.gsmsv.site", "/dashboard").toString())
      .toBe("https://bloombouquet.https.gsmsv.site/apps/evidence-vault/dashboard");
  });
});

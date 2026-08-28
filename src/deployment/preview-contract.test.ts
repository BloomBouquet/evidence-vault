import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("integration preview deployment contract", () => {
  it("pins the approved Evidence Vault integration preview boundary", () => {
    const contract = JSON.parse(readFileSync("deploy/preview-contract.json", "utf8"));

    expect(contract).toEqual({
      publicUrl: "https://bloombouquet.https.gsmsv.site/apps/evidence-vault/",
      oauthCallback: "https://bloombouquet.https.gsmsv.site/apps/evidence-vault/auth/bouquet/callback",
      providerUrl: "https://bloombouquet.https.gsmsv.site",
      serverDir: "/home/ubuntu/evidence-vault",
      processName: "evidence-vault-preview",
      port: 3011,
      integrationBranch: "develop",
      releaseBranch: "main",
    });
  });
});

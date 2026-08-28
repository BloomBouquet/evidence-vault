import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Evidence Vault app path hosting", () => {
  it("pins the Next.js base path under BloomBouquet", () => {
    const source = readFileSync("next.config.ts", "utf8");
    expect(source).toContain('basePath: "/apps/evidence-vault"');
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("integration preview server scripts", () => {
  it("starts only on the approved loopback and path-hosted BloomBouquet boundaries", () => {
    const start = readFileSync("scripts/start-preview.sh", "utf8");

    expect(start).toContain("/home/ubuntu/evidence-vault/.env.production");
    expect(start).toContain("127.0.0.1");
    expect(start).toContain("3011");
    expect(start).toContain("https://bloombouquet.https.gsmsv.site/apps/evidence-vault/");
    expect(start).toContain(
      "https://bloombouquet.https.gsmsv.site/apps/evidence-vault/auth/bouquet/callback",
    );
    expect(start).toContain("https://bloombouquet.https.gsmsv.site");
    expect(start).not.toContain("https://playground.https.gsmsv.site");
    expect(start).not.toContain('APP_BASE_URL" = "https://evidence-vault.https.gsmsv.site');
    expect(start).not.toContain("0.0.0.0");
  });

  it("deploys an exact develop SHA with migration, prefixed health, rollback, and provider gates", () => {
    const deploy = readFileSync("scripts/deploy-preview.sh", "utf8");

    expect(deploy).toContain("git merge-base --is-ancestor");
    expect(deploy).toContain("git reset --hard");
    expect(deploy).toContain("pnpm install --frozen-lockfile");
    expect(deploy).toContain("pnpm db:migrate");
    expect(deploy).toContain("pnpm build");
    expect(deploy).toContain("evidence-vault-preview");
    expect(deploy).toContain("127.0.0.1:3011/apps/evidence-vault/api/health");
    expect(deploy).toContain("https://bloombouquet.https.gsmsv.site/apps/evidence-vault/");
    expect(deploy).toContain(
      "https://bloombouquet.https.gsmsv.site/apps/evidence-vault/auth/bouquet/callback",
    );
    expect(deploy).toContain("PREVIOUS_SHA");
    expect(deploy).not.toContain("https://playground.https.gsmsv.site");
    expect(deploy).not.toContain('APP_BASE_URL" = "https://evidence-vault.https.gsmsv.site');
    expect(deploy).not.toMatch(/cat\s+[^\n]*\.env\.production/);
    expect(deploy).not.toContain("pm2 delete all");
    expect(deploy).not.toMatch(/drizzle[^\n]*(down|rollback)/i);
  });
});

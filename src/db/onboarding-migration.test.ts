import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("onboarding migration contract", () => {
  it("appends onboarding acceptances after the committed 0000-0002 sequence", () => {
    expect(existsSync("drizzle/0003_onboarding_acceptances.sql")).toBe(true);

    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    expect(journal.entries.map((entry) => entry.tag)).toEqual([
      "0000_evidence_vault_initial",
      "0001_deletion_job_idempotency",
      "0002_optional_merchant",
      "0003_onboarding_acceptances",
    ]);

    const sql = readFileSync("drizzle/0003_onboarding_acceptances.sql", "utf8");
    expect(sql).toContain('CREATE TABLE "ev_onboarding_acceptances"');
    expect(sql).toContain('"user_id" uuid NOT NULL');
    expect(sql).toContain('"age_14_confirmed_at" timestamp with time zone NOT NULL');
    expect(sql).toContain('"terms_version" varchar(64) NOT NULL');
    expect(sql).toContain('"privacy_version" varchar(64) NOT NULL');
    expect(sql).toContain("ev_onboarding_acceptances_owner_versions_unique");
  });
});

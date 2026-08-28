import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PostgreSQL migration contract", () => {
  it("ships a committed initial PostgreSQL migration", () => {
    expect(existsSync("drizzle/0000_evidence_vault_initial.sql")).toBe(true);
    expect(existsSync("drizzle/meta/_journal.json")).toBe(true);

    const sql = readFileSync("drizzle/0000_evidence_vault_initial.sql", "utf8");
    for (const table of [
      "ev_users",
      "ev_app_sessions",
      "ev_vault_items",
      "ev_deadlines",
      "ev_evidence_events",
      "ev_evidence_files",
      "ev_cases",
      "ev_case_evidence_links",
      "ev_export_packets",
      "ev_deletion_jobs",
    ]) {
      expect(sql).toContain(`\"${table}\"`);
    }
  });

  it("ships a deletion-job idempotency migration and journals it", () => {
    expect(existsSync("drizzle/0001_deletion_job_idempotency.sql")).toBe(true);
    const sql = readFileSync("drizzle/0001_deletion_job_idempotency.sql", "utf8");
    expect(sql).toContain("ev_deletion_jobs_owner_kind_target_unique");
    expect(sql).toContain("user_id");
    expect(sql).toContain("kind");
    expect(sql).toContain("target_id");

    const journal = readFileSync("drizzle/meta/_journal.json", "utf8");
    expect(journal).toContain("0001_deletion_job_idempotency");
  });

  it("ships the nullable merchant migration after existing develop migrations", () => {
    expect(existsSync("drizzle/0002_optional_merchant.sql")).toBe(true);
    const sql = readFileSync("drizzle/0002_optional_merchant.sql", "utf8");
    expect(sql).toContain('ALTER COLUMN "merchant_name" DROP NOT NULL');

    const journal = readFileSync("drizzle/meta/_journal.json", "utf8");
    expect(journal).toContain("0002_optional_merchant");
  });
});

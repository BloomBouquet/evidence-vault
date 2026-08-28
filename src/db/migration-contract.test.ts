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
});

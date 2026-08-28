import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");

describe("auth composition styles", () => {
  it.each([
    ".landing-auth-notice",
    ".auth-entry-error",
    ".auth-notice-actions",
    ".protected-shell",
    ".protected-header",
    ".protected-nav",
    ".protected-identity",
    ".protected-main",
    ".project-sign-out",
    ".dashboard-handoff",
  ])("defines %s", (selector) => {
    expect(css).toContain(selector);
  });

  it("includes a narrow-screen auth/protected layout rule", () => {
    expect(css).toMatch(/@media \(max-width: 520px\)[\s\S]*\.protected-header/);
    expect(css).toMatch(/@media \(max-width: 520px\)[\s\S]*\.auth-entry-error/);
  });
});

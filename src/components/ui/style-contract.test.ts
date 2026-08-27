import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readIfPresent(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

describe("design system style contract", () => {
  it("defines semantic product and accessibility tokens", () => {
    const tokens = readIfPresent("src/styles/tokens.css");
    expect(tokens, "tokens.css must exist").not.toBe("");

    for (const token of [
      "--color-bg-canvas",
      "--color-text-primary",
      "--color-brand",
      "--color-info",
      "--color-success",
      "--color-warning",
      "--color-danger",
      "--control-height-md",
      "--focus-ring",
    ]) {
      expect(tokens).toContain(token);
    }
  });

  it("defines reusable primitive classes", () => {
    const primitives = readIfPresent("src/styles/primitives.css");
    expect(primitives, "primitives.css must exist").not.toBe("");

    for (const className of [
      ".ev-button",
      ".ev-field",
      ".ev-notice",
      ".ev-badge",
      ".ev-deadline",
      ".ev-empty",
      ".ev-loading",
    ]) {
      expect(primitives).toContain(className);
    }
  });
});

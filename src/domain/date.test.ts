import { describe, expect, it } from "vitest";
import { addDays } from "./date";

describe("date-only arithmetic", () => {
  it("subtracts calendar days without local timezone drift", () => {
    expect(addDays("2026-08-28", -7)).toBe("2026-08-21");
  });

  it("crosses month boundaries deterministically", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

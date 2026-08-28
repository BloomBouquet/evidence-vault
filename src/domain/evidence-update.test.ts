import { expect, it } from "vitest";
import { updateEvidenceEventSchema } from "./evidence";

it("supports clearing note but rejects empty patches", () => {
  expect(updateEvidenceEventSchema.parse({ note: null })).toEqual({ note: null });
  expect(updateEvidenceEventSchema.safeParse({}).success).toBe(false);
});

import { expect, it } from "vitest";
import { updateDeadlineSchema } from "./deadline";

it("supports clearing sourceNote but rejects empty patches", () => {
  expect(updateDeadlineSchema.parse({ sourceNote: null })).toEqual({ sourceNote: null });
  expect(updateDeadlineSchema.safeParse({}).success).toBe(false);
});

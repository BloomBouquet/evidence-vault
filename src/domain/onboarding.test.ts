import { describe, expect, it } from "vitest";
import { acceptOnboardingSchema } from "./onboarding";

describe("acceptOnboardingSchema", () => {
  it("accepts only all-true acknowledgements", () => {
    expect(
      acceptOnboardingSchema.parse({
        age14Confirmed: true,
        termsAccepted: true,
        privacyAccepted: true,
      }),
    ).toEqual({
      age14Confirmed: true,
      termsAccepted: true,
      privacyAccepted: true,
    });
  });

  it.each([
    { age14Confirmed: false, termsAccepted: true, privacyAccepted: true },
    { age14Confirmed: true, termsAccepted: false, privacyAccepted: true },
    { age14Confirmed: true, termsAccepted: true, privacyAccepted: false },
    {},
  ])("rejects incomplete acknowledgement: %o", (input) => {
    expect(acceptOnboardingSchema.safeParse(input).success).toBe(false);
  });

  it("rejects ownership and policy fields from the client", () => {
    expect(
      acceptOnboardingSchema.safeParse({
        age14Confirmed: true,
        termsAccepted: true,
        privacyAccepted: true,
        ownerUserId: "user-b",
        termsVersion: "client-picked",
        privacyVersion: "client-picked",
      }).success,
    ).toBe(false);
  });
});

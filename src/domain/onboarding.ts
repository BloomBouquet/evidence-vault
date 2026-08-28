import { z } from "zod";

export const acceptOnboardingSchema = z
  .object({
    age14Confirmed: z.literal(true),
    termsAccepted: z.literal(true),
    privacyAccepted: z.literal(true),
  })
  .strict();

export type AcceptOnboardingInput = z.infer<typeof acceptOnboardingSchema>;

import { and, eq } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { onboardingAcceptances } from "@/src/db/schema";

export type OnboardingAcceptanceRecord = typeof onboardingAcceptances.$inferSelect;

export type CurrentAcceptanceKey = {
  ownerUserId: string;
  termsVersion: string;
  privacyVersion: string;
};

export type EnsureAcceptanceInput = CurrentAcceptanceKey & {
  acceptedAt: Date;
};

export type OnboardingAcceptanceStore = {
  findCurrent(input: CurrentAcceptanceKey): Promise<OnboardingAcceptanceRecord | null>;
  insertCurrent(input: EnsureAcceptanceInput): Promise<OnboardingAcceptanceRecord | null>;
};

const drizzleOnboardingAcceptanceStore: OnboardingAcceptanceStore = {
  async findCurrent({ ownerUserId, termsVersion, privacyVersion }) {
    const [row] = await getDb()
      .select()
      .from(onboardingAcceptances)
      .where(
        and(
          eq(onboardingAcceptances.userId, ownerUserId),
          eq(onboardingAcceptances.termsVersion, termsVersion),
          eq(onboardingAcceptances.privacyVersion, privacyVersion),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async insertCurrent({ ownerUserId, termsVersion, privacyVersion, acceptedAt }) {
    const [row] = await getDb()
      .insert(onboardingAcceptances)
      .values({
        userId: ownerUserId,
        age14ConfirmedAt: acceptedAt,
        termsVersion,
        termsAcceptedAt: acceptedAt,
        privacyVersion,
        privacyAcceptedAt: acceptedAt,
      })
      .onConflictDoNothing({
        target: [
          onboardingAcceptances.userId,
          onboardingAcceptances.termsVersion,
          onboardingAcceptances.privacyVersion,
        ],
      })
      .returning();
    return row ?? null;
  },
};

export function findCurrentAcceptanceWithStore(
  store: OnboardingAcceptanceStore,
  input: CurrentAcceptanceKey,
) {
  return store.findCurrent(input);
}

export async function ensureCurrentAcceptanceWithStore(
  store: OnboardingAcceptanceStore,
  input: EnsureAcceptanceInput,
) {
  const inserted = await store.insertCurrent(input);
  if (inserted) return inserted;

  const existing = await store.findCurrent({
    ownerUserId: input.ownerUserId,
    termsVersion: input.termsVersion,
    privacyVersion: input.privacyVersion,
  });
  if (!existing) throw new Error("onboarding_acceptance_persistence_failed");
  return existing;
}

export function findCurrentAcceptance(input: CurrentAcceptanceKey) {
  return findCurrentAcceptanceWithStore(drizzleOnboardingAcceptanceStore, input);
}

export function ensureCurrentAcceptance(input: EnsureAcceptanceInput) {
  return ensureCurrentAcceptanceWithStore(drizzleOnboardingAcceptanceStore, input);
}

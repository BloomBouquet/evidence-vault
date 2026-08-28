import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { evidenceEvents, vaultItems } from "@/src/db/schema";
import type { CreateEvidenceEventInput, UpdateEvidenceEventInput } from "@/src/domain/evidence";

export type EvidenceEventRecord = {
  id: string;
  vaultItemId: string;
  createdByUserId: string;
  occurredOn: string;
  eventType: string;
  title: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EventStore = {
  ownsVault(ownerUserId: string, vaultItemId: string): Promise<boolean>;
  list(vaultItemId: string): Promise<EvidenceEventRecord[]>;
  create(
    vaultItemId: string,
    createdByUserId: string,
    input: CreateEvidenceEventInput,
  ): Promise<EvidenceEventRecord | null>;
  update(
    vaultItemId: string,
    eventId: string,
    input: UpdateEvidenceEventInput,
  ): Promise<EvidenceEventRecord | null>;
  delete(vaultItemId: string, eventId: string): Promise<boolean>;
};

const drizzleEventStore: EventStore = {
  async ownsVault(ownerUserId, vaultItemId) {
    const [row] = await getDb()
      .select({ id: vaultItems.id })
      .from(vaultItems)
      .where(and(eq(vaultItems.id, vaultItemId), eq(vaultItems.userId, ownerUserId)))
      .limit(1);
    return Boolean(row);
  },

  async list(vaultItemId) {
    return getDb()
      .select()
      .from(evidenceEvents)
      .where(eq(evidenceEvents.vaultItemId, vaultItemId))
      .orderBy(asc(evidenceEvents.occurredOn), asc(evidenceEvents.createdAt));
  },

  async create(vaultItemId, createdByUserId, input) {
    const [row] = await getDb()
      .insert(evidenceEvents)
      .values({
        vaultItemId,
        createdByUserId,
        occurredOn: input.occurredOn,
        eventType: input.eventType,
        title: input.title,
        note: input.note ?? null,
      })
      .returning();
    return row ?? null;
  },

  async update(vaultItemId, eventId, input) {
    const [row] = await getDb()
      .update(evidenceEvents)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(evidenceEvents.id, eventId), eq(evidenceEvents.vaultItemId, vaultItemId)))
      .returning();
    return row ?? null;
  },

  async delete(vaultItemId, eventId) {
    const rows = await getDb()
      .delete(evidenceEvents)
      .where(and(eq(evidenceEvents.id, eventId), eq(evidenceEvents.vaultItemId, vaultItemId)))
      .returning({ id: evidenceEvents.id });
    return rows.length > 0;
  },
};

export type EventOwnerKey = { ownerUserId: string; vaultItemId: string };
export type EventOwnedKey = EventOwnerKey & { eventId: string };

export async function listEvidenceEventsWithStore(store: EventStore, input: EventOwnerKey) {
  if (!await store.ownsVault(input.ownerUserId, input.vaultItemId)) return null;
  return store.list(input.vaultItemId);
}

export async function createEvidenceEventWithStore(
  store: EventStore,
  input: EventOwnerKey & { input: CreateEvidenceEventInput },
) {
  if (!await store.ownsVault(input.ownerUserId, input.vaultItemId)) return null;
  return store.create(input.vaultItemId, input.ownerUserId, input.input);
}

export async function updateEvidenceEventWithStore(
  store: EventStore,
  input: EventOwnedKey & { input: UpdateEvidenceEventInput },
) {
  if (!await store.ownsVault(input.ownerUserId, input.vaultItemId)) return null;
  return store.update(input.vaultItemId, input.eventId, input.input);
}

export async function deleteEvidenceEventWithStore(store: EventStore, input: EventOwnedKey) {
  if (!await store.ownsVault(input.ownerUserId, input.vaultItemId)) return null;
  return store.delete(input.vaultItemId, input.eventId);
}

function ownedVaultIds(ownerUserId: string, vaultItemId: string) {
  return getDb()
    .select({ id: vaultItems.id })
    .from(vaultItems)
    .where(and(eq(vaultItems.id, vaultItemId), eq(vaultItems.userId, ownerUserId)));
}

export async function listEvidenceEvents({ ownerUserId, vaultItemId }: EventOwnerKey) {
  const rows = await getDb()
    .select()
    .from(evidenceEvents)
    .where(and(
      eq(evidenceEvents.vaultItemId, vaultItemId),
      inArray(evidenceEvents.vaultItemId, ownedVaultIds(ownerUserId, vaultItemId)),
    ))
    .orderBy(asc(evidenceEvents.occurredOn), asc(evidenceEvents.createdAt));

  if (rows.length > 0) return rows;
  const owned = await drizzleEventStore.ownsVault(ownerUserId, vaultItemId);
  return owned ? [] : null;
}

export async function createEvidenceEvent(input: EventOwnerKey & { input: CreateEvidenceEventInput }) {
  return createEvidenceEventWithStore(drizzleEventStore, input);
}

export async function updateEvidenceEvent({
  ownerUserId,
  vaultItemId,
  eventId,
  input,
}: EventOwnedKey & { input: UpdateEvidenceEventInput }) {
  const [row] = await getDb()
    .update(evidenceEvents)
    .set({ ...input, updatedAt: new Date() })
    .where(and(
      eq(evidenceEvents.id, eventId),
      eq(evidenceEvents.vaultItemId, vaultItemId),
      inArray(evidenceEvents.vaultItemId, ownedVaultIds(ownerUserId, vaultItemId)),
    ))
    .returning();
  return row ?? null;
}

export async function deleteEvidenceEvent({ ownerUserId, vaultItemId, eventId }: EventOwnedKey) {
  const rows = await getDb()
    .delete(evidenceEvents)
    .where(and(
      eq(evidenceEvents.id, eventId),
      eq(evidenceEvents.vaultItemId, vaultItemId),
      inArray(evidenceEvents.vaultItemId, ownedVaultIds(ownerUserId, vaultItemId)),
    ))
    .returning({ id: evidenceEvents.id });
  return rows.length > 0;
}

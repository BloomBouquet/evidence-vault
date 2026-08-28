import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { deadlines, evidenceEvents, vaultItems } from "@/src/db/schema";
import { addDays } from "@/src/domain/date";

export type DashboardDeadlineCandidate = {
  id: string;
  vaultItemId: string;
  vaultTitle: string;
  merchantName: string | null;
  type: string;
  dueDate: string;
  sourceType: string;
  sourceNote: string | null;
  vaultStatus: string;
  reminderState: string;
  createdAt: Date;
};

export type DashboardEventCandidate = {
  id: string;
  vaultItemId: string;
  vaultTitle: string;
  occurredOn: string;
  eventType: string;
  title: string;
  vaultStatus: string;
  createdAt: Date;
};

export type DashboardVaultCandidate = {
  id: string;
  title: string;
  category: string;
  merchantName: string | null;
  purchaseOrStartDate: string;
  amount: number | null;
  currency: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DashboardStore = {
  loadDeadlineCandidates(input: {
    ownerUserId: string;
    today: string;
    recentOverdueStart: string;
    limit: number;
  }): Promise<DashboardDeadlineCandidate[]>;
  loadEventCandidates(input: { ownerUserId: string; limit: number }): Promise<DashboardEventCandidate[]>;
  loadVaultCandidates(input: { ownerUserId: string; limit: number }): Promise<DashboardVaultCandidate[]>;
};

export type DashboardProjection = {
  upcomingDeadlines: Array<{
    id: string;
    vaultItemId: string;
    vaultTitle: string;
    merchantName: string | null;
    type: string;
    dueDate: string;
    sourceType: string;
    sourceNote: string | null;
  }>;
  recentEvents: Array<{
    id: string;
    vaultItemId: string;
    vaultTitle: string;
    occurredOn: string;
    eventType: string;
    title: string;
  }>;
  vaultItems: DashboardVaultCandidate[];
};

const drizzleDashboardStore: DashboardStore = {
  async loadDeadlineCandidates({ ownerUserId, today, recentOverdueStart, limit }) {
    const queueGroup = sql<number>`case
      when ${deadlines.dueDate} < ${today} then 0
      when ${deadlines.dueDate} = ${today} then 1
      else 2
    end`;
    const overdueDate = sql<string>`case when ${deadlines.dueDate} < ${today} then ${deadlines.dueDate} end`;
    const currentOrFutureDate = sql<string>`case when ${deadlines.dueDate} >= ${today} then ${deadlines.dueDate} end`;

    return getDb()
      .select({
        id: deadlines.id,
        vaultItemId: deadlines.vaultItemId,
        vaultTitle: vaultItems.title,
        merchantName: vaultItems.merchantName,
        type: deadlines.type,
        dueDate: deadlines.dueDate,
        sourceType: deadlines.sourceType,
        sourceNote: deadlines.sourceNote,
        vaultStatus: vaultItems.status,
        reminderState: deadlines.reminderState,
        createdAt: deadlines.createdAt,
      })
      .from(deadlines)
      .innerJoin(vaultItems, eq(deadlines.vaultItemId, vaultItems.id))
      .where(and(
        eq(vaultItems.userId, ownerUserId),
        eq(vaultItems.status, "active"),
        eq(deadlines.reminderState, "active"),
        gte(deadlines.dueDate, recentOverdueStart),
      ))
      .orderBy(queueGroup, sql`${overdueDate} desc nulls last`, sql`${currentOrFutureDate} asc nulls last`, deadlines.createdAt)
      .limit(limit);
  },

  async loadEventCandidates({ ownerUserId, limit }) {
    return getDb()
      .select({
        id: evidenceEvents.id,
        vaultItemId: evidenceEvents.vaultItemId,
        vaultTitle: vaultItems.title,
        occurredOn: evidenceEvents.occurredOn,
        eventType: evidenceEvents.eventType,
        title: evidenceEvents.title,
        vaultStatus: vaultItems.status,
        createdAt: evidenceEvents.createdAt,
      })
      .from(evidenceEvents)
      .innerJoin(vaultItems, eq(evidenceEvents.vaultItemId, vaultItems.id))
      .where(and(eq(vaultItems.userId, ownerUserId), eq(vaultItems.status, "active")))
      .orderBy(desc(evidenceEvents.occurredOn), desc(evidenceEvents.createdAt))
      .limit(limit);
  },

  async loadVaultCandidates({ ownerUserId, limit }) {
    return getDb()
      .select({
        id: vaultItems.id,
        title: vaultItems.title,
        category: vaultItems.category,
        merchantName: vaultItems.merchantName,
        purchaseOrStartDate: vaultItems.purchaseOrStartDate,
        amount: vaultItems.amount,
        currency: vaultItems.currency,
        description: vaultItems.description,
        status: vaultItems.status,
        createdAt: vaultItems.createdAt,
        updatedAt: vaultItems.updatedAt,
      })
      .from(vaultItems)
      .where(and(eq(vaultItems.userId, ownerUserId), eq(vaultItems.status, "active")))
      .orderBy(desc(vaultItems.updatedAt), desc(vaultItems.createdAt))
      .limit(limit);
  },
};

function deadlineQueueGroup(dueDate: string, today: string) {
  if (dueDate < today) return 0;
  if (dueDate === today) return 1;
  return 2;
}

export async function getDashboardProjectionWithStore(
  store: DashboardStore,
  { ownerUserId, today }: { ownerUserId: string; today: string },
): Promise<DashboardProjection> {
  const recentOverdueStart = addDays(today, -7);
  const [deadlineCandidates, eventCandidates, vaultCandidates] = await Promise.all([
    store.loadDeadlineCandidates({ ownerUserId, today, recentOverdueStart, limit: 10 }),
    store.loadEventCandidates({ ownerUserId, limit: 10 }),
    store.loadVaultCandidates({ ownerUserId, limit: 20 }),
  ]);

  const upcomingDeadlines = deadlineCandidates
    .filter((row) => row.vaultStatus === "active" && row.reminderState === "active" && row.dueDate >= recentOverdueStart)
    .sort((a, b) => {
      const groupDifference = deadlineQueueGroup(a.dueDate, today) - deadlineQueueGroup(b.dueDate, today);
      if (groupDifference !== 0) return groupDifference;
      if (a.dueDate < today && b.dueDate < today) return b.dueDate.localeCompare(a.dueDate);
      const dateDifference = a.dueDate.localeCompare(b.dueDate);
      if (dateDifference !== 0) return dateDifference;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    .slice(0, 10)
    .map(({ vaultStatus: _vaultStatus, reminderState: _reminderState, createdAt: _createdAt, ...row }) => row);

  const recentEvents = eventCandidates
    .filter((row) => row.vaultStatus === "active")
    .sort((a, b) => {
      const dateDifference = b.occurredOn.localeCompare(a.occurredOn);
      if (dateDifference !== 0) return dateDifference;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, 10)
    .map(({ vaultStatus: _vaultStatus, createdAt: _createdAt, ...row }) => row);

  const vaultItems = vaultCandidates
    .filter((row) => row.status === "active")
    .sort((a, b) => {
      const updatedDifference = b.updatedAt.getTime() - a.updatedAt.getTime();
      return updatedDifference !== 0 ? updatedDifference : b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, 20);

  return { upcomingDeadlines, recentEvents, vaultItems };
}

export function getDashboardProjection(input: { ownerUserId: string; today: string }) {
  return getDashboardProjectionWithStore(drizzleDashboardStore, input);
}

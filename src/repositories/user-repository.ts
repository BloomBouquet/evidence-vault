import { eq } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { users } from "@/src/db/schema";

export type UserIdentityRecord = {
  id: string;
  identitySubject: string;
  displayName: string;
  deletedAt: Date | null;
};

export type UserIdentityStore = {
  findBySubject(identitySubject: string): Promise<UserIdentityRecord | null>;
  insertUser(input: { identitySubject: string; displayName: string }): Promise<UserIdentityRecord>;
  updateDisplayName(id: string, displayName: string): Promise<UserIdentityRecord>;
};

function publicIdentity(row: UserIdentityRecord) {
  return {
    id: row.id,
    identitySubject: row.identitySubject,
    displayName: row.displayName,
  };
}

export async function upsertUserIdentity(
  store: UserIdentityStore,
  input: { identitySubject: string; displayName: string },
) {
  const current = await store.findBySubject(input.identitySubject);
  if (current?.deletedAt) throw new Error("account_deleted");
  if (current) {
    return publicIdentity(await store.updateDisplayName(current.id, input.displayName));
  }
  return publicIdentity(await store.insertUser(input));
}

const drizzleUserStore: UserIdentityStore = {
  async findBySubject(identitySubject) {
    const [row] = await getDb()
      .select({
        id: users.id,
        identitySubject: users.identitySubject,
        displayName: users.displayName,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.identitySubject, identitySubject))
      .limit(1);
    return row ?? null;
  },

  async insertUser(input) {
    const [row] = await getDb()
      .insert(users)
      .values(input)
      .returning({
        id: users.id,
        identitySubject: users.identitySubject,
        displayName: users.displayName,
        deletedAt: users.deletedAt,
      });
    if (!row) throw new Error("identity_creation_failed");
    return row;
  },

  async updateDisplayName(id, displayName) {
    const [row] = await getDb()
      .update(users)
      .set({ displayName, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        identitySubject: users.identitySubject,
        displayName: users.displayName,
        deletedAt: users.deletedAt,
      });
    if (!row) throw new Error("identity_update_failed");
    return row;
  },
};

export async function upsertActiveUserByIdentity(input: {
  identitySubject: string;
  displayName: string;
}) {
  return upsertUserIdentity(drizzleUserStore, input);
}

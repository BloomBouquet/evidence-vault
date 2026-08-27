import { createHash, randomBytes } from "node:crypto";
import {
  createSessionRecord,
  findActiveSessionByHash,
  revokeSessionByHash,
} from "@/src/repositories/session-repository";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ProjectSessionStore = {
  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<unknown>;
  find(tokenHash: string, now: Date): Promise<{ user: { id: string; displayName: string } } | null>;
  revoke(tokenHash: string): Promise<unknown>;
};

export function hashSessionToken(rawToken: string) {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export async function createProjectSessionWithStore(
  store: ProjectSessionStore,
  userId: string,
  now = new Date(),
) {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await store.create({ userId, tokenHash: hashSessionToken(rawToken), expiresAt });
  return { rawToken, expiresAt };
}

export async function resolveProjectSessionWithStore(
  store: ProjectSessionStore,
  rawToken: string | null | undefined,
  now = new Date(),
) {
  if (!rawToken) return null;
  const row = await store.find(hashSessionToken(rawToken), now);
  if (!row) return null;
  return { id: row.user.id, displayName: row.user.displayName };
}

export async function revokeProjectSessionWithStore(
  store: ProjectSessionStore,
  rawToken: string | null | undefined,
) {
  if (!rawToken) return;
  await store.revoke(hashSessionToken(rawToken));
}

const repositoryStore: ProjectSessionStore = {
  create: createSessionRecord,
  find: findActiveSessionByHash,
  revoke: revokeSessionByHash,
};

export async function createProjectSession(userId: string, now = new Date()) {
  return createProjectSessionWithStore(repositoryStore, userId, now);
}

export async function resolveProjectSession(
  rawToken: string | null | undefined,
  now = new Date(),
) {
  return resolveProjectSessionWithStore(repositoryStore, rawToken, now);
}

export async function revokeProjectSession(rawToken: string | null | undefined) {
  return revokeProjectSessionWithStore(repositoryStore, rawToken);
}

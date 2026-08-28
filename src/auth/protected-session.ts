import { resolveProjectSession } from "./project-session";

export type ProtectedUser = {
  id: string;
  displayName: string;
};

export type ProtectedSessionResolver = (
  rawToken: string,
) => Promise<{ id: string; displayName: string } | null>;

export async function resolveProtectedUser(
  rawToken: string | null | undefined,
  resolver: ProtectedSessionResolver = resolveProjectSession,
): Promise<ProtectedUser | null> {
  if (!rawToken) return null;

  const user = await resolver(rawToken);
  if (!user) return null;

  return {
    id: user.id,
    displayName: user.displayName,
  };
}

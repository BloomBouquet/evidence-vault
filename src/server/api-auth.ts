import { resolveProjectSession } from "@/src/auth/project-session";

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator < 0 || trimmed.slice(0, separator) !== name) continue;

    const value = trimmed.slice(separator + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

export async function resolveApiUser(
  request: Request,
  resolveSession: typeof resolveProjectSession = resolveProjectSession,
) {
  return resolveSession(readCookie(request, "ev_session"));
}

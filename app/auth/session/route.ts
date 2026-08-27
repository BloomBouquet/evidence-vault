import { NextResponse } from "next/server";
import { resolveProjectSession } from "@/src/auth/project-session";

export type SessionProbeDependencies = {
  resolveSession: typeof resolveProjectSession;
};

function readCookie(request: Request, name: string) {
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

export async function createSessionProbeResponse(
  request: Request,
  dependencies: SessionProbeDependencies,
) {
  const rawToken = readCookie(request, "ev_session");
  const user = await dependencies.resolveSession(rawToken);
  return NextResponse.json({ user });
}

export function GET(request: Request) {
  return createSessionProbeResponse(request, { resolveSession: resolveProjectSession });
}

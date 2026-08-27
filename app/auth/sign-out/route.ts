import { NextResponse } from "next/server";
import { getAuthConfig } from "@/src/auth/config";
import { revokeProjectSession } from "@/src/auth/project-session";

export type SignOutDependencies = {
  revokeSession: typeof revokeProjectSession;
  secureCookies: boolean;
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

export async function createSignOutResponse(
  request: Request,
  dependencies: SignOutDependencies,
) {
  await dependencies.revokeSession(readCookie(request, "ev_session"));
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: "ev_session",
    value: "",
    httpOnly: true,
    secure: dependencies.secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function POST(request: Request) {
  return createSignOutResponse(request, {
    revokeSession: revokeProjectSession,
    secureCookies: getAuthConfig().secureCookies,
  });
}

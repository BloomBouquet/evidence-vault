import { NextResponse } from "next/server";
import { exchangeBouquetCode, fetchBouquetUserInfo } from "@/src/auth/bouquet-client";
import { getAuthConfig, type AuthConfig } from "@/src/auth/config";
import { openLoginAttempt, sanitizeReturnTo } from "@/src/auth/login-attempt";
import { statesMatch } from "@/src/auth/pkce";
import { createProjectSession } from "@/src/auth/project-session";
import { upsertActiveUserByIdentity } from "@/src/repositories/user-repository";

export type CallbackDependencies = {
  config: AuthConfig;
  openAttempt: typeof openLoginAttempt;
  statesMatch: typeof statesMatch;
  exchangeCode: typeof exchangeBouquetCode;
  fetchUserInfo: typeof fetchBouquetUserInfo;
  upsertUser: typeof upsertActiveUserByIdentity;
  createSession: typeof createProjectSession;
  now: () => Date;
};

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    if (trimmed.slice(0, separator) !== name) continue;
    const value = trimmed.slice(separator + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

function clearAttemptCookie(response: NextResponse, secure: boolean) {
  response.cookies.set({
    name: "ev_oauth_attempt",
    value: "",
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/auth/bouquet",
    maxAge: 0,
  });
}

function applyCallbackPrivacyHeaders(response: NextResponse) {
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}

function failureResponse(config: AuthConfig) {
  const response = NextResponse.redirect(new URL("/?auth_error=oauth_failed", config.appBaseUrl));
  clearAttemptCookie(response, config.secureCookies);
  return applyCallbackPrivacyHeaders(response);
}

export async function createBouquetCallbackResponse(
  request: Request,
  dependencies: CallbackDependencies,
) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const sealedAttempt = readCookie(request, "ev_oauth_attempt");

  if (!code || !state || !sealedAttempt) return failureResponse(dependencies.config);

  try {
    const attempt = dependencies.openAttempt(sealedAttempt, dependencies.config.sessionSecret);
    if (!dependencies.statesMatch(attempt.state, state)) throw new Error("oauth_state_mismatch");

    const token = await dependencies.exchangeCode(dependencies.config, {
      code,
      verifier: attempt.verifier,
    });
    const userInfo = await dependencies.fetchUserInfo(dependencies.config, token.accessToken);
    const user = await dependencies.upsertUser({
      identitySubject: userInfo.sub,
      displayName: userInfo.name,
    });
    const session = await dependencies.createSession(user.id);

    const returnTo = sanitizeReturnTo(attempt.returnTo);
    const response = NextResponse.redirect(new URL(returnTo, dependencies.config.appBaseUrl));
    const maxAge = Math.max(
      0,
      Math.floor((session.expiresAt.getTime() - dependencies.now().getTime()) / 1000),
    );
    response.cookies.set({
      name: "ev_session",
      value: session.rawToken,
      httpOnly: true,
      secure: dependencies.config.secureCookies,
      sameSite: "lax",
      path: "/",
      maxAge,
      expires: session.expiresAt,
    });
    clearAttemptCookie(response, dependencies.config.secureCookies);
    return applyCallbackPrivacyHeaders(response);
  } catch {
    return failureResponse(dependencies.config);
  }
}

export function GET(request: Request) {
  return createBouquetCallbackResponse(request, {
    config: getAuthConfig(),
    openAttempt: openLoginAttempt,
    statesMatch,
    exchangeCode: exchangeBouquetCode,
    fetchUserInfo: fetchBouquetUserInfo,
    upsertUser: upsertActiveUserByIdentity,
    createSession: createProjectSession,
    now: () => new Date(),
  });
}

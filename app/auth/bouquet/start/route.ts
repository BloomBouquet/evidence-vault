import { NextResponse } from "next/server";
import { buildBouquetPortalUrl } from "@/src/auth/bouquet-client";
import { getAuthConfig, type AuthConfig } from "@/src/auth/config";
import { sanitizeReturnTo, sealLoginAttempt } from "@/src/auth/login-attempt";
import { createPkceAttempt } from "@/src/auth/pkce";

type LoginStartDependencies = {
  config: AuthConfig;
  createAttempt: () => { state: string; challenge: string; verifier: string };
  sealAttempt: typeof sealLoginAttempt;
  now: () => number;
};

export function createLoginStartResponse(
  request: Request,
  dependencies: LoginStartDependencies,
) {
  const requestUrl = new URL(request.url);
  const returnTo = sanitizeReturnTo(requestUrl.searchParams.get("returnTo"));
  const { state, challenge, verifier } = dependencies.createAttempt();
  const sealedAttempt = dependencies.sealAttempt(
    {
      state,
      verifier,
      returnTo,
      expiresAt: dependencies.now() + 600_000,
    },
    dependencies.config.sessionSecret,
  );

  const portalUrl = buildBouquetPortalUrl(dependencies.config, { state, challenge });
  const response = NextResponse.redirect(portalUrl);
  response.cookies.set({
    name: "ev_oauth_attempt",
    value: sealedAttempt,
    httpOnly: true,
    secure: dependencies.config.secureCookies,
    sameSite: "lax",
    path: "/auth/bouquet",
    maxAge: 600,
  });
  return response;
}

export function GET(request: Request) {
  return createLoginStartResponse(request, {
    config: getAuthConfig(),
    createAttempt: createPkceAttempt,
    sealAttempt: sealLoginAttempt,
    now: Date.now,
  });
}

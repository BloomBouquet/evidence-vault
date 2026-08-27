import type { AuthConfig } from "./config";

function normalized(message: "bouquet_token_exchange_failed" | "bouquet_userinfo_failed"): never {
  throw new Error(message);
}

async function parseJson(response: Response) {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

export function buildBouquetPortalUrl(
  config: AuthConfig,
  input: { state: string; challenge: string },
) {
  const url = new URL("/bloom/", config.bouquetBaseUrl);
  url.searchParams.set("mode", "auth");
  url.searchParams.set("client_id", config.bouquetClientId);
  url.searchParams.set("redirect_uri", config.bouquetRedirectUri.toString());
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export async function exchangeBouquetCode(
  config: AuthConfig,
  input: { code: string; verifier: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ accessToken: string; expiresIn: number }> {
  try {
    const response = await fetchImpl(new URL("/api/bouquet/oauth/token", config.bouquetBaseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: config.bouquetClientId,
        code: input.code,
        redirectUri: config.bouquetRedirectUri.toString(),
        codeVerifier: input.verifier,
      }),
      cache: "no-store",
    });
    if (!response.ok) normalized("bouquet_token_exchange_failed");
    const payload = await parseJson(response);
    if (!payload || typeof payload !== "object") normalized("bouquet_token_exchange_failed");
    const accessToken = "access_token" in payload ? payload.access_token : null;
    const expiresInValue = "expires_in" in payload ? payload.expires_in : 0;
    if (typeof accessToken !== "string" || !accessToken.trim()) normalized("bouquet_token_exchange_failed");
    if (typeof expiresInValue !== "number" || expiresInValue < 0 || !Number.isFinite(expiresInValue)) {
      normalized("bouquet_token_exchange_failed");
    }
    return { accessToken, expiresIn: expiresInValue };
  } catch (error) {
    if (error instanceof Error && error.message === "bouquet_token_exchange_failed") throw error;
    normalized("bouquet_token_exchange_failed");
  }
}

export async function fetchBouquetUserInfo(
  config: AuthConfig,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ sub: string; name: string }> {
  try {
    const response = await fetchImpl(new URL("/api/bouquet/oauth/userinfo", config.bouquetBaseUrl), {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) normalized("bouquet_userinfo_failed");
    const payload = await parseJson(response);
    if (!payload || typeof payload !== "object") normalized("bouquet_userinfo_failed");
    const sub = "sub" in payload ? payload.sub : null;
    const name = "name" in payload ? payload.name : null;
    if (typeof sub !== "string" || !sub.trim() || typeof name !== "string" || !name.trim()) {
      normalized("bouquet_userinfo_failed");
    }
    return { sub: sub.trim(), name: name.trim() };
  } catch (error) {
    if (error instanceof Error && error.message === "bouquet_userinfo_failed") throw error;
    normalized("bouquet_userinfo_failed");
  }
}
